import 'dotenv/config'
import { createHash, randomInt, timingSafeEqual } from 'node:crypto'
import { createServer } from 'node:http'
import { Client, Events, GatewayIntentBits, REST, Routes, SlashCommandBuilder } from 'discord.js'

const required = ['DISCORD_BOT_TOKEN', 'DISCORD_CLIENT_ID', 'ADMIN_DISCORD_IDS', 'OTP_PEPPER']
for (const name of required) {
  if (!process.env[name]) {
    throw new Error(`Missing environment variable: ${name}`)
  }
}

const port = Number(process.env.PORT || 8787)
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT must be a number between 1 and 65535')
}
const host = process.env.HOST || '127.0.0.1'
const pepper = process.env.OTP_PEPPER
const expirationMs = 5 * 60 * 1000
const adminIds = new Set(process.env.ADMIN_DISCORD_IDS.split(',').map(value => value.trim()).filter(Boolean))
const adminTriggerPseudos = new Set((process.env.ADMIN_TRIGGER_PSEUDOS || 'kylanmc0001,matteo').split(',').map(value => value.trim().toLowerCase()).filter(Boolean))
const pendingOtps = new Map()
const otpRequestCooldowns = new Map()
const requestCooldownMs = 60 * 1000

function hashOtp(code) {
  return createHash('sha256').update(`${pepper}:${code}`).digest()
}

function matchesOtp(code, expectedHash) {
  const actualHash = hashOtp(code)
  return actualHash.length === expectedHash.length && timingSafeEqual(actualHash, expectedHash)
}

function createOtp() {
  return String(randomInt(0, 1_000_000)).padStart(6, '0')
}

async function sendOtpToUser(user) {
  const code = createOtp()
  pendingOtps.set(user.id, { hash: hashOtp(code), expiresAt: Date.now() + expirationMs })
  try {
    await user.send(`Code OTP BuildLauncher: ${code}\nValable pendant 5 minutes et utilisable une seule fois.`)
    return true
  } catch {
    pendingOtps.delete(user.id)
    return false
  }
}

function json(response, statusCode, body) {
  const payload = JSON.stringify(body)
  response.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
    'content-length': Buffer.byteLength(payload)
  })
  response.end(payload)
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let body = ''
    request.on('data', chunk => {
      body += chunk
      if (body.length > 4096) reject(new Error('Request too large'))
    })
    request.on('end', () => {
      try {
        resolve(JSON.parse(body || '{}'))
      } catch {
        reject(new Error('Invalid JSON'))
      }
    })
    request.on('error', reject)
  })
}

const httpServer = createServer(async (request, response) => {
  if (request.method === 'OPTIONS') {
    response.writeHead(204, {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET, POST, OPTIONS',
      'access-control-allow-headers': 'content-type'
    })
    response.end()
    return
  }

  if (request.method === 'GET' && request.url === '/health') {
    json(response, 200, { ok: true })
    return
  }

  if (request.method === 'POST' && request.url === '/otp/request') {
    try {
      const body = await readJson(request)
      const pseudo = typeof body.pseudo === 'string' ? body.pseudo.trim().toLowerCase() : ''
      if (!adminTriggerPseudos.has(pseudo)) {
        json(response, 403, { ok: false, error: 'admin_pseudo_required' })
        return
      }
      if (!client.isReady()) {
        json(response, 503, { ok: false, error: 'discord_bot_not_ready' })
        return
      }

      const lastRequest = otpRequestCooldowns.get(pseudo) || 0
      const retryAfter = requestCooldownMs - (Date.now() - lastRequest)
      if (retryAfter > 0) {
        json(response, 429, { ok: false, error: 'otp_request_cooldown', retryAfterSeconds: Math.ceil(retryAfter / 1000) })
        return
      }
      otpRequestCooldowns.set(pseudo, Date.now())

      let delivered = 0
      for (const adminId of adminIds) {
        try {
          const user = await client.users.fetch(adminId)
          if (await sendOtpToUser(user)) delivered += 1
        } catch {
          console.error(`Impossible d'envoyer le DM OTP a un admin configure (${adminId}).`)
        }
      }

      if (delivered === 0) {
        otpRequestCooldowns.delete(pseudo)
        json(response, 502, { ok: false, error: 'otp_dm_delivery_failed' })
        return
      }

      json(response, 200, { ok: true })
    } catch {
      json(response, 400, { ok: false, error: 'invalid_request' })
    }
    return
  }

  if (request.method === 'POST' && request.url === '/otp/verify') {
    try {
      const body = await readJson(request)
      const code = typeof body.code === 'string' ? body.code.trim() : ''
      const pseudo = typeof body.pseudo === 'string' ? body.pseudo.trim().toLowerCase() : ''
      if(!adminTriggerPseudos.has(pseudo)) {
        json(response, 403, { ok: false, error: 'admin_pseudo_required' })
        return
      }
      if (!/^\d{6}$/.test(code)) {
        json(response, 400, { ok: false, error: 'invalid_code' })
        return
      }

      const now = Date.now()
      for (const [userId, record] of pendingOtps) {
        if (record.expiresAt <= now) pendingOtps.delete(userId)
      }

      const record = [...pendingOtps.entries()].find(([, value]) => matchesOtp(code, value.hash))
      if (!record) {
        json(response, 401, { ok: false, error: 'invalid_or_expired_code' })
        return
      }

      pendingOtps.delete(record[0])
      json(response, 200, { ok: true, role: 'admin' })
    } catch {
      json(response, 400, { ok: false, error: 'invalid_request' })
    }
    return
  }

  json(response, 404, { ok: false, error: 'not_found' })
})

const client = new Client({ intents: [GatewayIntentBits.Guilds] })

async function registerOtpCommand(applicationId, guildId) {
  const command = new SlashCommandBuilder()
    .setName('otp')
    .setDescription('Envoie un code OTP admin en message prive')
    .toJSON()

  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN)
  const route = guildId
    ? Routes.applicationGuildCommands(applicationId, guildId)
    : Routes.applicationCommands(applicationId)

  try {
    await rest.put(route, { body: [command] })
    console.log(`Commande /otp enregistree${guildId ? ` sur le serveur ${guildId}` : ' globalement'}.`)
  } catch (error) {
    console.error(`Impossible d'enregistrer /otp (Discord ${error.code ?? 'unknown'}): ${error.message}`)
    if (error.code === 50001 || error.code === 50013) {
      console.error('Verifie que le bot est invite dans le serveur cible avec le scope applications.commands, et que DISCORD_GUILD_ID est l’ID de ce serveur.')
    }
  }
}

client.once(Events.ClientReady, async readyClient => {
  console.log(`Bot connecte: ${readyClient.user.tag}`)

  const applicationId = readyClient.application.id
  if (process.env.DISCORD_CLIENT_ID !== applicationId) {
    console.warn('DISCORD_CLIENT_ID ne correspond pas a l’application associee au token du bot; l’ID du bot sera utilise.')
  }

  const guildId = process.env.DISCORD_GUILD_ID
  if (guildId && !readyClient.guilds.cache.has(guildId)) {
    console.error(`Le bot n'est pas membre du serveur ${guildId}. Invite-le sur ce serveur avec les scopes bot et applications.commands.`)
    return
  }

  await registerOtpCommand(applicationId, guildId)
})

client.on(Events.Error, error => console.error('Erreur Discord du bot:', error))
client.on(Events.GuildCreate, guild => {
  if (guild.id === process.env.DISCORD_GUILD_ID) {
    registerOtpCommand(client.application.id, guild.id)
  }
})

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand() || interaction.commandName !== 'otp') return

  if (!adminIds.has(interaction.user.id)) {
    await interaction.reply({ content: 'Acces refuse.', ephemeral: true })
    return
  }

  try {
    const delivered = await sendOtpToUser(interaction.user)
    if (!delivered) throw new Error('DM delivery failed')
    await interaction.reply({ content: 'Le code OTP a ete envoye en message prive.', ephemeral: true })
  } catch {
    pendingOtps.delete(interaction.user.id)
    await interaction.reply({ content: 'Impossible de vous envoyer un message prive.', ephemeral: true })
  }
})

client.login(process.env.DISCORD_BOT_TOKEN).catch(error => {
  console.error('Connexion Discord impossible:', error.message)
  process.exitCode = 1
})
httpServer.listen(port, host, () => console.log(`API OTP: http://${host}:${port}`))
