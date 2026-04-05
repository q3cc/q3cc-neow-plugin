import {
  getUserData,
  syncUserData,
  saveUserData,
  buildHelpLines,
  buildUserInfoLines,
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
  getRandomQuestion,
  calculateRewards
} from '../utils/game24.js'
import {
  ML_DIFFICULTIES,
  getMlGame,
  setMlGame,
  deleteMlGame,
  createPassword,
  evaluatePasswordGuess,
  formatMlHistory,
  getMlRemainingSeconds,
  isMlTimeout,
  shouldMlExplode,
  calculateMlRewards
} from '../utils/ml-game.js'

const loggerInstance = (typeof Bot !== 'undefined' && Bot?.logger)
  || (typeof logger !== 'undefined' ? logger : null)
  || globalThis.logger
const logInfo = loggerInstance?.info?.bind(loggerInstance) || console.log
const logWarn = loggerInstance?.warn?.bind(loggerInstance) || console.warn

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
          reg: /^(?:\/|#)?setfavor(?:\s+.+)?\s*$/i,
          fnc: 'setFavor'
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
          reg: /^(?:\/|#)?givefavor(?:\s+.+)?\s*$/i,
          fnc: 'giveFavor'
        },
        {
          reg: /^(?:\/|#)?rmcoin(?:\s+.+)?\s*$/i,
          fnc: 'removeCoin'
        },
        {
          reg: /^(?:\/|#)?rmfavor(?:\s+.+)?\s*$/i,
          fnc: 'removeFavor'
        },
        {
          reg: /^(?:\/|#)?transfer(?:\s+.+)?\s*$/i,
          fnc: 'transferCoins'
        },
        {
          reg: /^(?:\/|#)?ml\s*$/i,
          fnc: 'showMlMenu'
        },
        {
          reg: /^(?:\/|#)?ml\s+start\s*$/i,
          fnc: 'startMlGame'
        },
        {
          reg: /^(?:\/|#)?ml\s+difficulty\s*$/i,
          fnc: 'showMlDifficultyMenu'
        },
        {
          reg: /^(?:\/|#)?ml\s+difficulty\s+(\d+)\s*$/i,
          fnc: 'setMlDifficulty'
        },
        {
          reg: /^(?:\/|#)?ml\s+(\d{4})\s*$/i,
          fnc: 'submitMlAnswer'
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
      `UID: ${user.uid}`,
      ...buildUserInfoLines(user, {
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

  async showMlMenu(e) {
    if (!await this.ensureUsable(e)) {
      return true
    }

    const user = getUserData(e.user_id)
    const difficulty = ML_DIFFICULTIES[user.mlDifficulty] || ML_DIFFICULTIES[1]

    await e.reply([
      '你在整理旧物的时候，翻出了一台布满灰尘的破译机。',
      '大喵喵拍了拍机身，屏幕竟然真的亮了起来喵~',
      '只要成功破译密码，好像就能得到一点奖励呢。',
      '',
      `⚡ 当前体力: ${user.stamina}/${user.maxStamina} (${difficulty.stamina}体力/局)`,
      '/ml start - 开始游戏',
      '/ml difficulty - 修改难度'
    ].join('\n'), true)

    return true
  }

  async startMlGame(e) {
    if (!await this.ensureUsable(e)) {
      return true
    }

    const sessionId = this.getSessionId(e)
    const active24Game = getActiveGame(sessionId, e.user_id)
    if (active24Game) {
      await e.reply([
        '主人现在正在玩 24 点喵~',
        '先完成当前的 `/24g answer ...`，再来开启密码破译吧~'
      ].join('\n'), true)
      return true
    }

    const activeGame = getMlGame(sessionId, e.user_id)
    if (activeGame) {
      await e.reply([
        '主人已经有一局进行中的密码破译啦喵~',
        '先继续输入四位数字，或者等这局结束后再来一局吧~'
      ].join('\n'), true)
      return true
    }

    const user = getUserData(e.user_id)
    const difficulty = ML_DIFFICULTIES[user.mlDifficulty] || ML_DIFFICULTIES[1]

    if (user.stamina < difficulty.stamina) {
      await e.reply([
        '体力不足',
        `当前体力: ${user.stamina}/${user.maxStamina}`,
        `需要体力: ${difficulty.stamina}`,
        '体力恢复速度: 1点/分钟'
      ].join('\n'), true)
      return true
    }

    user.stamina -= difficulty.stamina
    syncUserData(user, { persist: true })

    setMlGame(sessionId, e.user_id, {
      password: createPassword(),
      difficulty: user.mlDifficulty,
      history: [],
      startTime: Date.now()
    })

    await this.replyWithTimeout(e, [
      '密码破译开始喵~',
      '我已经把四位密码锁好了。',
      '请使用 /ml <任意四位数字> 开始破译',
      '例如: /ml 1234'
    ].join('\n'), true)

    return true
  }

  async showMlDifficultyMenu(e) {
    if (!await this.ensureUsable(e)) {
      return true
    }

    const user = getUserData(e.user_id)
    const difficulty = ML_DIFFICULTIES[user.mlDifficulty] || ML_DIFFICULTIES[1]

    await e.reply([
      `主人当前的难度为: ${difficulty.name}`,
      '',
      ...Object.entries(ML_DIFFICULTIES).map(([, item]) => `${item.name}: ${item.desc}`),
      '',
      '所选难度越高, 消耗体力越多, 奖励越丰富',
      '/ml difficulty 0 - 简单',
      '/ml difficulty 1 - 普通',
      '/ml difficulty 2 - 困难',
      '/ml difficulty 3 - 极限',
      '/ml difficulty 4 - 另类极限'
    ].join('\n'), true)
    return true
  }

  async setMlDifficulty(e) {
    if (!await this.ensureUsable(e)) {
      return true
    }

    const match = (e.msg || '').match(/^(?:\/|#)?ml\s+difficulty\s+(\d+)\s*$/i)
    const difficultyId = match ? parseInt(match[1]) : NaN

    if (!(difficultyId in ML_DIFFICULTIES)) {
      await e.reply('无效的难度等级\n可选: 0-简单, 1-普通, 2-困难, 3-极限, 4-另类极限', true)
      return true
    }

    const user = getUserData(e.user_id)
    user.mlDifficulty = difficultyId
    saveUserData()

    const difficulty = ML_DIFFICULTIES[difficultyId]
    await e.reply([
      `密码破译难度已设置为: ${difficulty.name}`,
      difficulty.desc,
      `消耗体力: ${difficulty.stamina}`
    ].join('\n'), true)
    return true
  }

  async submitMlAnswer(e) {
    if (!await this.ensureUsable(e)) {
      return true
    }

    const sessionId = this.getSessionId(e)
    const game = getMlGame(sessionId, e.user_id)
    if (!game) {
      return false
    }

    const difficulty = ML_DIFFICULTIES[game.difficulty] || ML_DIFFICULTIES[1]
    if (isMlTimeout(game, difficulty)) {
      const lines = [
        '密码破译 - 失败',
        ...formatMlHistory(game.history),
        `时间到啦喵... 正确答案是 ${game.password}`,
        '/ml start - 再来一次'
      ]
      deleteMlGame(sessionId, e.user_id)
      await this.replyWithTimeout(e, lines.join('\n'), true)
      return true
    }

    const match = (e.msg || '').match(/^(?:\/|#)?ml\s+(\d{4})\s*$/i)
    const guess = match?.[1]
    if (!guess) {
      return false
    }

    const marks = evaluatePasswordGuess(game.password, guess)
    game.history.push({ guess, marks })

    if (guess === game.password) {
      const user = getUserData(e.user_id)
      const rewards = calculateMlRewards(game, difficulty)

      user.coins += rewards.coinReward
      user.favor += rewards.favorReward
      syncUserData(user, { persist: true })

      const lines = [
        '密码破译 - 成功',
        ...formatMlHistory(game.history),
        `总共试了 ${game.history.length} 次`,
        `游戏机吐出了 ${rewards.coinReward} 枚 Star 币, 同时还获得了来自大喵喵的 ${rewards.favorReward} 点好感度`,
        '/ml start - 再来一次'
      ]

      deleteMlGame(sessionId, e.user_id)
      await this.replyWithTimeout(e, lines.join('\n'), true)
      return true
    }

    if (shouldMlExplode(game, difficulty)) {
      const lines = [
        '密码破译 - 失败',
        ...formatMlHistory(game.history),
        '第 5 次之后，老旧的机器突然冒出一阵黑烟，直接炸机了喵...',
        `正确答案是 ${game.password}`,
        '/ml start - 再来一次'
      ]
      deleteMlGame(sessionId, e.user_id)
      await this.replyWithTimeout(e, lines.join('\n'), true)
      return true
    }

    if (difficulty.maxAttempts && game.history.length >= difficulty.maxAttempts) {
      const lines = [
        '密码破译 - 失败',
        ...formatMlHistory(game.history),
        `次数用完啦... 正确答案是 ${game.password}`,
        '/ml start - 再来一次'
      ]
      deleteMlGame(sessionId, e.user_id)
      await this.replyWithTimeout(e, lines.join('\n'), true)
      return true
    }

    const lines = []
    const remainSeconds = getMlRemainingSeconds(game, difficulty)
    if (remainSeconds !== null) {
      lines.push(`密码破译 - 剩余时间 ${remainSeconds} 秒`)
    } else {
      lines.push('密码破译 - 正在进行')
    }

    lines.push(...formatMlHistory(game.history))
    lines.push('使用: /ml <任意四位数字> 以继续破译')
    lines.push('例如: /ml 1234')

    await this.replyWithTimeout(e, lines.join('\n'), true)
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

  async setFavor(e) {
    if (!await this.ensureUsable(e)) {
      return true
    }

    if (!await this.ensureAdmin(e)) {
      return true
    }

    const match = (e.msg || '').match(/^(?:\/|#)?setfavor(?:\s+(\d+)\s+(\d+))?\s*$/i)
    if (!match || !match[1] || !match[2]) {
      await e.reply([
        '/setfavor <QQ> <数量>',
        '示例: /setfavor 123456789 100'
      ].join('\n'), true)
      return true
    }

    const target = getUserData(match[1])
    const amount = parseInt(match[2])

    target.favor = amount
    syncUserData(target, { persist: true })
    saveUserData()

    await e.reply(`已将 ${match[1]} 的好感度设置为 ${target.favor} 喵~`, true)
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

  async giveFavor(e) {
    if (!await this.ensureUsable(e)) {
      return true
    }

    if (!await this.ensureAdmin(e)) {
      return true
    }

    const match = (e.msg || '').match(/^(?:\/|#)?givefavor(?:\s+(\d+)\s+(\d+))?\s*$/i)
    if (!match || !match[1] || !match[2]) {
      await e.reply([
        '/givefavor <QQ> <数量>',
        '示例: /givefavor 123456789 50'
      ].join('\n'), true)
      return true
    }

    const amount = parseInt(match[2])
    if (!Number.isInteger(amount) || amount <= 0) {
      await e.reply('给予好感度数量必须是大于 0 的整数喵~', true)
      return true
    }

    const target = getUserData(match[1])
    target.favor += amount
    syncUserData(target, { persist: true })
    saveUserData()

    await e.reply(`已给 ${match[1]} ${amount} 点好感度喵~`, true)
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

  async removeFavor(e) {
    if (!await this.ensureUsable(e)) {
      return true
    }

    if (!await this.ensureAdmin(e)) {
      return true
    }

    const match = (e.msg || '').match(/^(?:\/|#)?rmfavor(?:\s+(\d+)\s+(\d+))?\s*$/i)
    if (!match || !match[1] || !match[2]) {
      await e.reply([
        '/rmfavor <QQ> <数量>',
        '示例: /rmfavor 123456789 50'
      ].join('\n'), true)
      return true
    }

    const amount = parseInt(match[2])
    if (!Number.isInteger(amount) || amount <= 0) {
      await e.reply('扣除好感度数量必须是大于 0 的整数喵~', true)
      return true
    }

    const target = getUserData(match[1])
    target.favor = Math.max(0, target.favor - amount)
    syncUserData(target, { persist: true })
    saveUserData()

    await e.reply(`已从 ${match[1]} 扣除 ${amount} 点好感度喵~`, true)
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

    const sessionId = this.getSessionId(e)
    const activeMlGame = getMlGame(sessionId, e.user_id)
    if (activeMlGame) {
      await e.reply([
        '主人现在正在进行密码破译喵~',
        '先把这局 `/ml` 结束掉，再来开启新的 24 点吧~'
      ].join('\n'), true)
      return true
    }

    const activeGame = getActiveGame(sessionId, e.user_id)
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

    const question = getRandomQuestion(config)
    const numbers = question.numbers
    const solution = question.solution

    if (config.stamina > 0) {
      user.stamina -= config.stamina
      syncUserData(user, { persist: true })
    }

    setActiveGame(sessionId, e.user_id, {
      difficulty: user.difficulty,
      bankId: question.bankId,
      questionId: question.questionId,
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

    await this.replyWithTimeout(e, message, true)
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

    const sessionId = this.getSessionId(e)
    const game = getActiveGame(sessionId, e.user_id)

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

      await this.replyWithTimeout(e, [
        '回答正确喵~',
        `用时 ${elapsed} 秒`,
        `你获得了 ${rewardInfo.coinReward} 枚 Star 币和来自大喵喵的 ${rewardInfo.favorReward} 点好感度`
      ].join('\n'), true)
    } else {
      const penalty = config.penalty
      user.coins = Math.max(0, user.coins - penalty)
      syncUserData(user, { persist: true })

      await this.replyWithTimeout(e, [
        '恭喜主人...答错啦!',
        `大喵喵开心地拿走了主人的 ${penalty} 枚 Star 币`,
        `正确答案: ${correctAnswer} (可能非唯一解)`
      ].join('\n'), true)
    }

    deleteActiveGame(sessionId, e.user_id)
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

  getSessionId(e) {
    return String(e.group_id || e.friend_id || `private:${e.user_id}`)
  }

  async replyWithTimeout(e, message, quote = true, timeoutMs = 8000) {
    try {
      await Promise.race([
        e.reply(message, quote),
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error(`reply timeout after ${timeoutMs}ms`)), timeoutMs)
        })
      ])
    } catch (error) {
      logWarn(`[neow][reply-timeout] group=${e.group_id || 'private'} user=${e.user_id} msg=${JSON.stringify(e.msg)} error=${error?.message || error}`)
    }
  }
}
