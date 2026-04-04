import plugin from '../../lib/plugins/plugin.js'
import { MeowUserInfoPlugin } from './meow_user_info.js'
import { MeowGame24Plugin } from './meow_game_24.js'

export const Version = Object.freeze({
  version: 'v0.0.5'
})

if (globalThis.Bot?.logger?.info) {
  globalThis.Bot.logger.info('---------^_^---------')
  globalThis.Bot.logger.info(`neow插件${Version.version}初始化~`)
} else {
  console.log(`neow插件${Version.version}初始化~`)
}

export class MainPlugin extends plugin {
  constructor() {
    super({
      name: 'neow_plugin',
      dsc: 'neow 插件总入口',
      event: 'message',
      priority: 5000,
      rule: [
        {
          reg: /^\/(?:neowhelp|nhelp)\s*$/i,
          fnc: 'showHelp'
        },
        {
          reg: /^\/ping\s*$/i,
          fnc: 'ping'
        },
        {
          reg: /^\/my\s*$/i,
          fnc: 'myInfo'
        },
        {
          reg: /^\/24g\s+sign\s*$/i,
          fnc: 'dailySign'
        },
        {
          reg: /^\/24g\s*$/i,
          fnc: 'showMenu'
        },
        {
          reg: /^\/24g\s+start\s*$/i,
          fnc: 'startGame'
        },
        {
          reg: /^\/24g\s+difficulty\s*$/i,
          fnc: 'showDifficultyMenu'
        },
        {
          reg: /^\/24g\s+difficulty\s+(\d+)\s*$/i,
          fnc: 'setDifficulty'
        },
        {
          reg: /^\/24g\s+answer\s+(.+)$/i,
          fnc: 'submitAnswer'
        }
      ]
    })

    this.userPlugin = new MeowUserInfoPlugin()
    this.gamePlugin = new MeowGame24Plugin()
  }

  async showHelp(e) {
    return this.userPlugin.showHelp(e)
  }

  async ping(e) {
    return this.userPlugin.ping(e)
  }

  async myInfo(e) {
    return this.userPlugin.myInfo(e)
  }

  async dailySign(e) {
    return this.userPlugin.dailySign(e)
  }

  async showMenu(e) {
    return this.gamePlugin.showMenu(e)
  }

  async startGame(e) {
    return this.gamePlugin.startGame(e)
  }

  async showDifficultyMenu(e) {
    return this.gamePlugin.showDifficultyMenu(e)
  }

  async setDifficulty(e) {
    return this.gamePlugin.setDifficulty(e)
  }

  async submitAnswer(e) {
    return this.gamePlugin.submitAnswer(e)
  }
}

export default MainPlugin
