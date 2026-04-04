import {
  getUserData,
  syncUserData,
  saveUserData,
  buildHelpLines,
  buildUserInfoLines,
  difficultyNames,
  recordDailySign,
  getRandomSignPrompt,
  getRandomPokeAction,
  issueSuCode,
  verifySuCode,
  grantTemporaryAdmin,
  clearTemporaryAdmin,
  isTemporaryAdmin,
  getAdminRemainingMs,
  banUser,
  tempBanUser,
  unbanUser,
  isBannedUser,
  getBanRemainingMs
} from '../utils/user-data.js'
import {
  GAME24_DIFFICULTIES,
  getActiveGame,
  setActiveGame,
  deleteActiveGame,
  generateNumbers,
  solve24,
  calculateRewards
} from '../utils/game24.js'

const loggerInstance = (typeof Bot !== 'undefined' && Bot?.logger)
  || (typeof logger !== 'undefined' ? logger : null)
  || globalThis.logger
const logInfo = loggerInstance?.info?.bind(loggerInstance) || console.log

export class NeowPlugin extends plugin {
  constructor() {
    super({
      name: 'neow_plugin',
      dsc: 'neow 插件总入口',
      event: 'message',
      priority: 5000,
      rule: [
        {
          reg: /^(?:\/|#)?(?:neowhelp|nhelp)\s*$/i,
          fnc: 'showHelp'
        },
        {
          reg: /^(?:\/|#)?ping\s*$/i,
          fnc: 'ping'
        },
        {
          reg: /^(?:\/|#)?su(?:\s+.+)?\s*$/i,
          fnc: 'switchAdmin'
        },
        {
          reg: /^(?:\/|#)?demote\s*$/i,
          fnc: 'demoteAdmin'
        },
        {
          reg: /^(?:\/|#)?(?:poke|戳)\s*$/i,
          fnc: 'pokeMeow'
        },
        {
          reg: /^(?:\/|#)?my\s*$/i,
          fnc: 'myInfo'
        },
        {
          reg: /^(?:\/|#)?setcoin(?:\s+.+)?\s*$/i,
          fnc: 'setCoin'
        },
        {
          reg: /^(?:\/|#)?ban(?:\s+.+)?\s*$/i,
          fnc: 'banAccount'
        },
        {
          reg: /^(?:\/|#)?tempban(?:\s+.+)?\s*$/i,
          fnc: 'tempBanAccount'
        },
        {
          reg: /^(?:\/|#)?unban(?:\s+.+)?\s*$/i,
          fnc: 'unbanAccount'
        },
        {
          reg: /^(?:\/|#)?givecoin(?:\s+.+)?\s*$/i,
          fnc: 'giveCoin'
        },
        {
          reg: /^(?:\/|#)?rmcoin(?:\s+.+)?\s*$/i,
          fnc: 'removeCoin'
        },
        {
          reg: /^(?:\/|#)?transfer(?:\s+.+)?\s*$/i,
          fnc: 'transferCoins'
        },
        {
          reg: /^(?:\/|#)?24g\s*$/i,
          fnc: 'showMenu'
        },
        {
          reg: /^(?:\/|#)?24g\s+start\s*$/i,
          fnc: 'startGame'
        },
        {
          reg: /^(?:\/|#)?24g\s+difficulty\s*$/i,
          fnc: 'showDifficultyMenu'
        },
        {
          reg: /^(?:\/|#)?24g\s+difficulty\s+(\d+)\s*$/i,
          fnc: 'setDifficulty'
        },
        {
          reg: /^(?:\/|#)?24g\s+answer\s+(.+)$/i,
          fnc: 'submitAnswer'
        },
        {
          reg: /^(?:\/|#)?(?:sign|签到|qd|checkin)\s*$/i,
          fnc: 'dailySign'
        },
        {
          reg: /^.+$/s,
          fnc: 'listenGameInput',
          log: false
        }
      ]
    })

    this.difficulties = GAME24_DIFFICULTIES
  }

  async showHelp(e) {
    if (!await this.ensureUsable(e)) {
      return true
    }

    const user = getUserData(e.user_id)
    await e.reply(buildHelpLines({
      isAdmin: isTemporaryAdmin(user),
      adminRemainingMs: getAdminRemainingMs(user)
    }).join('\n'), true)
    return true
  }

  async ping(e) {
    if (!await this.ensureUsable(e)) {
      return true
    }

    await e.reply('大喵喵在线，可以正常使用喵~', true)
    return true
  }

  async switchAdmin(e) {
    if (!await this.ensureUsable(e)) {
      return true
    }

    const user = getUserData(e.user_id)
    const match = (e.msg || '').match(/^(?:\/|#)?su(?:\s+(.+))?\s*$/i)
    const inputCode = (match?.[1] || '').trim()

    if (isTemporaryAdmin(user)) {
      const until = grantTemporaryAdmin(user)
      const remainSeconds = Math.ceil((until - Date.now()) / 1000)
      await e.reply(`临时管理员权限已续期喵~ ${remainSeconds} 秒后自动失效`, true)
      return true
    }

    if (e.isMaster) {
      const until = grantTemporaryAdmin(user)
      const remainSeconds = Math.ceil((until - Date.now()) / 1000)
      await e.reply(`主人已经切换为管理员啦喵~ ${remainSeconds} 秒后会自动恢复`, true)
      return true
    }

    if (!inputCode) {
      const code = issueSuCode(user)
      logInfo(`[neow][su] user=${e.user_id} code=${code}`)
      await e.reply([
        '已为你生成管理员验证码喵~',
        '请查看后台日志后输入 /su <验证码>',
        '验证码 5 分钟内有效，验证成功后权限持续 3 分钟'
      ].join('\n'), true)
      return true
    }

    if (!verifySuCode(user, inputCode)) {
      await e.reply([
        '验证码不正确或已过期喵~',
        '请重新发送 /su 获取新的验证码'
      ].join('\n'), true)
      return true
    }

    const until = grantTemporaryAdmin(user)
    const remainSeconds = Math.ceil((until - Date.now()) / 1000)
    await e.reply(`验证成功，已经切换为临时管理员喵~ ${remainSeconds} 秒后自动失效`, true)
    return true
  }

  async demoteAdmin(e) {
    if (!await this.ensureUsable(e)) {
      return true
    }

    const user = getUserData(e.user_id)
    const hadAdmin = isTemporaryAdmin(user)
    const hadCode = Boolean(user.suCode)

    clearTemporaryAdmin(user)

    if (hadAdmin) {
      await e.reply('临时管理员身份已撤销喵~', true)
      return true
    }

    if (hadCode) {
      await e.reply('管理员验证码已作废喵~', true)
      return true
    }

    await e.reply('你现在本来就不是临时管理员喵~', true)
    return true
  }

  async pokeMeow(e) {
    if (!await this.ensureUsable(e)) {
      return true
    }

    await e.reply(getRandomPokeAction(), true)
    return true
  }

  async myInfo(e) {
    if (!await this.ensureUsable(e)) {
      return true
    }

    const user = getUserData(e.user_id)

    await e.reply([
      '大喵喵的个人信息面板',
      '',
      `账号ID: ${e.user_id}`,
      ...buildUserInfoLines(user, {
        difficultyName: difficultyNames[user.difficulty] || difficultyNames[1],
        includeRegisterTime: true
      })
    ].join('\n'), true)

    return true
  }

  async transferCoins(e) {
    if (!await this.ensureUsable(e)) {
      return true
    }

    const match = (e.msg || '').match(/^(?:\/|#)?transfer(?:\s+(\d+)\s+(\d+))?\s*$/i)

    if (!match || !match[1] || !match[2]) {
      await e.reply([
        '/transfer - 将 Star 币转给其它用户',
        '/transfer <QQ> <数量>',
        '示例: /transfer 123456789 50'
      ].join('\n'), true)
      return true
    }

    const targetId = match[1]
    const amount = parseInt(match[2])

    if (!Number.isInteger(amount) || amount <= 0) {
      await e.reply('转账数量必须是大于 0 的整数喵~', true)
      return true
    }

    if (String(targetId) === String(e.user_id)) {
      await e.reply('不可以把 Star 币转给自己喵~', true)
      return true
    }

    const sender = getUserData(e.user_id)
    if (sender.coins < amount) {
      await e.reply([
        '主人的 Star 币不够喵~',
        `当前只有 ${sender.coins} 枚 Star 币`
      ].join('\n'), true)
      return true
    }

    const receiver = getUserData(targetId)
    sender.coins -= amount
    receiver.coins += amount
    syncUserData(sender)
    syncUserData(receiver)
    saveUserData()

    await e.reply([
      '转赠成功喵~',
      `已向 ${targetId} 转出 ${amount} 枚 Star 币`,
      `你当前还有 ${sender.coins} 枚 Star 币`
    ].join('\n'), true)

    return true
  }

  async setCoin(e) {
    if (!await this.ensureUsable(e)) {
      return true
    }

    if (!await this.ensureAdmin(e)) {
      return true
    }

    const match = (e.msg || '').match(/^(?:\/|#)?setcoin(?:\s+(\d+)\s+(\d+))?\s*$/i)
    if (!match || !match[1] || !match[2]) {
      await e.reply([
        '/setcoin <QQ> <数量>',
        '示例: /setcoin 123456789 100'
      ].join('\n'), true)
      return true
    }

    const target = getUserData(match[1])
    const amount = parseInt(match[2])

    target.coins = amount
    syncUserData(target)
    saveUserData()

    await e.reply(`已将 ${match[1]} 的 Star 币设置为 ${amount} 喵~`, true)
    return true
  }

  async banAccount(e) {
    if (!await this.ensureUsable(e)) {
      return true
    }

    if (!await this.ensureAdmin(e)) {
      return true
    }

    const match = (e.msg || '').match(/^(?:\/|#)?ban(?:\s+(\d+))?\s*$/i)
    if (!match || !match[1]) {
      await e.reply([
        '/ban <QQ>',
        '示例: /ban 123456789'
      ].join('\n'), true)
      return true
    }

    const target = getUserData(match[1])
    banUser(target)
    await e.reply(`已永久封禁 ${match[1]} 喵~`, true)
    return true
  }

  async tempBanAccount(e) {
    if (!await this.ensureUsable(e)) {
      return true
    }

    if (!await this.ensureAdmin(e)) {
      return true
    }

    const match = (e.msg || '').match(/^(?:\/|#)?tempban(?:\s+(\d+)\s+(\d+))?\s*$/i)
    if (!match || !match[1] || !match[2]) {
      await e.reply([
        '/tempban <QQ> <分钟>',
        '示例: /tempban 123456789 30'
      ].join('\n'), true)
      return true
    }

    const minutes = parseInt(match[2])
    if (!Number.isInteger(minutes) || minutes <= 0) {
      await e.reply('临时封禁时长必须是大于 0 的整数分钟喵~', true)
      return true
    }

    const target = getUserData(match[1])
    tempBanUser(target, minutes * 60 * 1000)
    await e.reply(`已临时封禁 ${match[1]} ${minutes} 分钟喵~`, true)
    return true
  }

  async unbanAccount(e) {
    if (!await this.ensureUsable(e)) {
      return true
    }

    if (!await this.ensureAdmin(e)) {
      return true
    }

    const match = (e.msg || '').match(/^(?:\/|#)?unban(?:\s+(\d+))?\s*$/i)
    if (!match || !match[1]) {
      await e.reply([
        '/unban <QQ>',
        '示例: /unban 123456789'
      ].join('\n'), true)
      return true
    }

    const target = getUserData(match[1])
    unbanUser(target)
    await e.reply(`已解除 ${match[1]} 的封禁状态喵~`, true)
    return true
  }

  async giveCoin(e) {
    if (!await this.ensureUsable(e)) {
      return true
    }

    if (!await this.ensureAdmin(e)) {
      return true
    }

    const match = (e.msg || '').match(/^(?:\/|#)?givecoin(?:\s+(\d+)\s+(\d+))?\s*$/i)
    if (!match || !match[1] || !match[2]) {
      await e.reply([
        '/givecoin <QQ> <数量>',
        '示例: /givecoin 123456789 50'
      ].join('\n'), true)
      return true
    }

    const amount = parseInt(match[2])
    if (!Number.isInteger(amount) || amount <= 0) {
      await e.reply('给予数量必须是大于 0 的整数喵~', true)
      return true
    }

    const target = getUserData(match[1])
    target.coins += amount
    syncUserData(target)
    saveUserData()

    await e.reply(`已给 ${match[1]} ${amount} 枚 Star 币喵~`, true)
    return true
  }

  async removeCoin(e) {
    if (!await this.ensureUsable(e)) {
      return true
    }

    if (!await this.ensureAdmin(e)) {
      return true
    }

    const match = (e.msg || '').match(/^(?:\/|#)?rmcoin(?:\s+(\d+)\s+(\d+))?\s*$/i)
    if (!match || !match[1] || !match[2]) {
      await e.reply([
        '/rmcoin <QQ> <数量>',
        '示例: /rmcoin 123456789 50'
      ].join('\n'), true)
      return true
    }

    const amount = parseInt(match[2])
    if (!Number.isInteger(amount) || amount <= 0) {
      await e.reply('删除数量必须是大于 0 的整数喵~', true)
      return true
    }

    const target = getUserData(match[1])
    target.coins = Math.max(0, target.coins - amount)
    syncUserData(target)
    saveUserData()

    await e.reply(`已从 ${match[1]} 扣除 ${amount} 枚 Star 币喵~`, true)
    return true
  }

  async showMenu(e) {
    if (!await this.ensureUsable(e)) {
      return true
    }

    const user = getUserData(e.user_id)
    const config = this.difficulties[user.difficulty]

    await e.reply([
      '源至二十四点卡牌玩法',
      '据说有点费脑子..?',
      '',
      '哦对了..千万不要蒙题.(凑近)因为会有可怕的事情发生——',
      '',
      `⚡ 当前体力: ${user.stamina}/${user.maxStamina} (${config.stamina}体力/局)`,
      '/24g start - 开始游戏',
      '/24g difficulty - 修改难度'
    ].join('\n'), true)

    return true
  }

  async startGame(e) {
    if (!await this.ensureUsable(e)) {
      return true
    }

    const activeGame = getActiveGame(e.group_id, e.user_id)
    if (activeGame) {
      await e.reply([
        '主人已经有一局进行中的24点啦喵~',
        '先用 /24g answer 提交当前答案，再开始新的一局吧~'
      ].join('\n'), true)
      return true
    }

    const user = getUserData(e.user_id)
    const config = this.difficulties[user.difficulty]
    if (user.stamina < config.stamina) {
      await e.reply([
        '体力不足',
        `当前体力: ${user.stamina}/${user.maxStamina}`,
        `需要体力: ${config.stamina}`,
        '体力恢复速度: 1点/分钟'
      ].join('\n'), true)
      return true
    }

    const numbers = generateNumbers(config.numCount)
    const solution = solve24(numbers)

    if (config.stamina > 0) {
      user.stamina -= config.stamina
      syncUserData(user, { persist: true })
    }

    setActiveGame(e.group_id, e.user_id, {
      difficulty: user.difficulty,
      numbers,
      solution,
      startTime: Date.now()
    })

    let message = `以下数字是否可以组成24点?\n${numbers.join(', ')}\n`

    if (config.needFormula) {
      message += '回答指令-可以组成: /24g answer <算式>\n'
      message += '回答指令-不能组成: /24g answer no\n'
      message += '回答示范: /24g answer 1+2*(3/4)'
    } else {
      message += '/24g answer y - 可以\n'
      message += '/24g answer n - 不可以'
    }

    await e.reply(message, true)
    return true
  }

  async dailySign(e) {
    if (!await this.ensureUsable(e)) {
      return true
    }

    const user = getUserData(e.user_id)
    const now = Date.now()
    const today = new Date().setHours(0, 0, 0, 0)

    if (user.lastSign >= today) {
      const tomorrow = new Date(today + 86400000)
      await e.reply([
        '今天已经签到过了喵~',
        `下次签到时间: ${tomorrow.toLocaleString('zh-CN')}`
      ].join('\n'), true)
      return true
    }

    const coinReward = Math.floor(Math.random() * 50) + 1
    const favorReward = Math.floor(Math.random() * 30) + 1

    user.coins += coinReward
    user.favor += favorReward
    user.signCount = (user.signCount || 0) + 1
    user.lastSign = now
    syncUserData(user, { persist: true })

    const signOrder = recordDailySign(e.user_id, now)
    await e.reply([
      `${getRandomSignPrompt()} 你是今天第 ${signOrder} 位签到的`,
      `累计签到 ${user.signCount} 次`,
      `获得了 ${coinReward} 枚 Star 币和来自大喵喵的 ${favorReward} 点好感度`
    ].join('\n'), true)

    return true
  }

  async showDifficultyMenu(e) {
    if (!await this.ensureUsable(e)) {
      return true
    }

    const user = getUserData(e.user_id)

    await e.reply([
      `当前难度: ${this.difficulties[user.difficulty].name}`,
      '',
      '/24g difficulty 0 - 练习 (0体力/局, 0奖励)',
      '/24g difficulty 1 - 普通 (10体力/局, 1-4 Star 币, 1-4 好感度)',
      '/24g difficulty 2 - 困难 (20体力/局, 1-7 Star 币, 1-7 好感度)',
      '/24g difficulty 3 - 极限 (30体力/局, 1-15 Star 币, 1-15 好感度, 需输入算式)'
    ].join('\n'), true)

    return true
  }

  async setDifficulty(e) {
    if (!await this.ensureUsable(e)) {
      return true
    }

    const match = (e.msg || '').match(/^(?:\/|#)?24g\s+difficulty\s+(\d+)\s*$/i)
    const difficulty = match ? parseInt(match[1]) : NaN

    if (!(difficulty in this.difficulties)) {
      await e.reply('无效的难度等级\n可选: 0-练习, 1-普通, 2-困难, 3-极限', true)
      return true
    }

    const user = getUserData(e.user_id)
    user.difficulty = difficulty
    saveUserData()

    const config = this.difficulties[difficulty]
    await e.reply([
      `难度已设置为: ${config.name}`,
      `消耗体力: ${config.stamina}`,
      `奖励范围: ${config.coinRange[0]}-${config.coinRange[1]} Star 币 / ${config.favorRange[0]}-${config.favorRange[1]} 好感度`,
      config.needFormula ? '需要回答完整算式' : '只需回答是否可以组成'
    ].join('\n'), true)

    return true
  }

  async submitAnswer(e) {
    if (!await this.ensureUsable(e)) {
      return true
    }

    const game = getActiveGame(e.group_id, e.user_id)

    if (!game) {
      return false
    }

    const answer = this.extractAnswer(e.msg)
    const config = this.difficulties[game.difficulty]
    const user = getUserData(e.user_id)

    let isCorrect = false
    const correctAnswer = game.solution || 'no'

    if (config.needFormula) {
      if (game.solution) {
        try {
          const result = eval(answer)
          isCorrect = Math.abs(result - 24) < 1e-6
        } catch {
          isCorrect = false
        }
      } else {
        isCorrect = answer.toLowerCase() === 'no'
      }
    } else if (game.solution) {
      isCorrect = answer.toLowerCase() === 'y'
    } else {
      isCorrect = answer.toLowerCase() === 'n'
    }

    const elapsed = Math.floor((Date.now() - game.startTime) / 1000)
    const rewardInfo = calculateRewards(game, config, elapsed)

    if (isCorrect) {
      user.coins += rewardInfo.coinReward
      user.favor += rewardInfo.favorReward
      syncUserData(user, { persist: true })

      await e.reply([
        '回答正确喵~',
        `用时 ${elapsed} 秒`,
        `你获得了 ${rewardInfo.coinReward} 枚 Star 币和来自大喵喵的 ${rewardInfo.favorReward} 点好感度`
      ].join('\n'), true)
    } else {
      const penalty = config.penalty
      user.coins = Math.max(0, user.coins - penalty)
      syncUserData(user, { persist: true })

      await e.reply([
        '恭喜主人...答错啦!',
        `大喵喵开心地拿走了主人的 ${penalty} 枚 Star 币`,
        `正确答案: ${correctAnswer} (可能非唯一解)`
      ].join('\n'), true)
    }

    deleteActiveGame(e.group_id, e.user_id)
    return true
  }

  async listenGameInput(e) {
    return false
  }

  async ensureAdmin(e) {
    const user = getUserData(e.user_id)
    if (isTemporaryAdmin(user)) {
      return true
    }

    await e.reply([
      '当前不是管理员喵~',
      '请先使用 /su 切换临时管理员身份'
    ].join('\n'), true)
    return false
  }

  async ensureUsable(e) {
    if (e.isMaster) {
      return true
    }

    const user = getUserData(e.user_id)
    if (!isBannedUser(user)) {
      return true
    }

    const remainMs = getBanRemainingMs(user)
    const remainText = remainMs === -1
      ? '当前为永久封禁'
      : `剩余 ${Math.ceil(remainMs / 60000)} 分钟`

    await e.reply([
      '你已被大喵喵封禁，暂时不能使用这些指令喵~',
      remainText
    ].join('\n'), true)
    return false
  }

  extractAnswer(msg) {
    const raw = (msg || '').trim()
    const commandAnswer = raw.replace(/^(?:\/|#)?24g\s+answer\s+/i, '').trim()
    return commandAnswer || raw
  }
}
