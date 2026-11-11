const fs = require('node:fs')
const path = require('node:path')
const AdmZip = require('adm-zip')

const projectRoot = path.resolve(__dirname, '..')
const sourceDirectory = path.join(projectRoot, 'bot-otp')
const sourceDependencies = path.join(sourceDirectory, 'node_modules')
const stagingDirectory = path.join(projectRoot, 'build', 'otp-runtime')

if(!fs.existsSync(sourceDependencies)) {
    throw new Error('OTP dependencies are missing. Run npm ci --prefix bot-otp first.')
}

fs.rmSync(stagingDirectory, { recursive: true, force: true })
fs.mkdirSync(stagingDirectory, { recursive: true })
fs.copyFileSync(path.join(sourceDirectory, '.env.example'), path.join(stagingDirectory, '.env.example'))

const archive = new AdmZip()
archive.addLocalFile(path.join(sourceDirectory, 'server.js'))
archive.addLocalFolder(sourceDependencies, 'node_modules')
archive.writeZip(path.join(stagingDirectory, 'bot-otp-runtime.zip'))