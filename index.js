import fs from 'fs'
import path from 'path'
import { fileURLToPath, pathToFileURL } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const loggerInstance = globalThis.logger

let pluginVersion = '0.0.6'
const packagePath = path.join(__dirname, 'package.json')

if (fs.existsSync(packagePath)) {
  try {
    pluginVersion = JSON.parse(fs.readFileSync(packagePath, 'utf8')).version || pluginVersion
  } catch (error) {
    loggerInstance?.error?.(`[neow] 读取 package.json 失败: ${error.message}`)
  }
}

export const Version = Object.freeze({
  version: `v${pluginVersion}`
})

const appDir = path.join(__dirname, 'apps')
const appFiles = fs.existsSync(appDir)
  ? fs.readdirSync(appDir).filter(file => file.endsWith('.js'))
  : []

const results = await Promise.allSettled(
  appFiles.map(file => import(pathToFileURL(path.join(appDir, file)).href))
)

const apps = {}

appFiles.forEach((file, index) => {
  const name = file.replace(/\.js$/i, '')
  const result = results[index]

  if (result.status !== 'fulfilled') {
    loggerInstance?.error?.(`[neow] 载入插件文件失败: ${name}`)
    loggerInstance?.error?.(result.reason)
    return
  }

  const mod = result.value
  const exportKey = Object.keys(mod)[0]

  if (!exportKey) {
    loggerInstance?.warn?.(`[neow] 插件文件未导出类: ${name}`)
    return
  }

  apps[name] = mod[exportKey]
})

if (loggerInstance?.info) {
  loggerInstance.info('---------^_^---------')
  loggerInstance.info(`neow插件${Version.version}初始化~`)
} else {
  console.log('---------^_^---------')
  console.log(`neow插件${Version.version}初始化~`)
}

export { apps }
