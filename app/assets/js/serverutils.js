const { Type } = require('helios-distribution-types')

exports.isModdedServer = server => Array.isArray(server?.modules)
    && server.modules.some(module => [Type.ForgeHosted, Type.Forge, Type.Fabric].includes(module.rawModule?.type))

exports.getServerDisplayName = server => {
    const rawName = server?.rawServer?.name ?? server?.name ?? ''
    const name = rawName.trim()

    if (!name) {
        return 'Serveur'
    }

    return /cobblemon/i.test(name) ? 'Build' : name
}