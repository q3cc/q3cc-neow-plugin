import { MeowUserInfoPlugin } from './meow_user_info.js'
import { MeowGame24Plugin } from './meow_game_24.js'

export const Version = Object.freeze({
  version: 'v0.0.1'
})

if (globalThis.Bot?.logger?.info) {
  globalThis.Bot.logger.info('---------^_^---------')
  globalThis.Bot.logger.info(`neow插件${Version.version}初始化~`)
} else {
  console.log(`neow插件${Version.version}初始化~`)
}

export {
  Version,
  MeowUserInfoPlugin,
  MeowGame24Plugin
}

export default [
  MeowUserInfoPlugin,
  MeowGame24Plugin
]
