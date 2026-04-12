import {
  getUserData,
  syncUserData,
  saveUserData,
  buildHelpLines,
  buildUserInfoLines,
  getCoinLeaderboard,
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
  getBanRemainingMs,
  updateUserNickname
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
  ML_FORCE_TEXT_DIFFICULTY,
  ML_REPLY_MODES,
  getMlGame,
  setMlGame,
  deleteMlGame,
  createPassword,
  evaluatePasswordGuess,
  formatMlHistory,
  getMlRemainingSeconds,
  isMlTimeout,
  shouldMlExplode,
  calculateMlRewards,
  calculateMlPenalty,
  normalizeMlReplyMode,
  resolveMlReplyMode
} from '../utils/ml-game.js'
import {
  WORDLE_DIFFICULTIES,
  getWordleGame,
  setWordleGame,
  deleteWordleGame,
  getRandomWordleWord,
  isValidWordleWord,
  normalizeWordleGuess,
  evaluateWordleGuess,
  formatWordleHistory,
  getWordleRemainingSeconds,
  isWordleTimeout,
  calculateWordleRewards,
  calculateWordlePenalty
} from '../utils/wordle-game.js'
import {
  fetchWordSuggestions,
  fetchWordleMeaning,
  formatWordSuggestionBlock,
  formatWordLookupBlock,
  formatWordleMeaningBlock,
  resolveWordSuggestionDetail
} from '../utils/wordle-dict.js'
import {
  clearPendingDictSelection,
  pickPendingDictSelection,
  setPendingDictSelection
} from '../utils/dict-selection.js'
import {
  buySeeds,
  deliverOrder,
  getFarmAddonStatus,
  getFarmRegistry,
  getFarmState,
  harvestPlots,
  plantSeed,
  saveFarmData,
  sellCrops,
  waterPlots
} from '../utils/farm-game.js'
import { isBlockedSexualWord } from '../utils/blocked-words.js'
import {
  BOOM_COUNTDOWN_MS,
  BOOM_DIFFICULTIES,
  BOOM_MAX_PLAYERS,
  BOOM_MIN_COINS,
  BOOM_ROOM_IDLE_MS,
  addBoomPlayer,
  applyBoomGuess,
  createBoomRoom,
  deleteBoomRoom,
  getBoomCurrentPlayerId,
  getBoomGuessRange,
  getBoomRoom,
  isBoomRoomIdleActive,
  isBoomCountdownActive,
  isBoomParticipant,
  prepareBoomStart,
  removeBoomPlayer,
  setBoomCountdown,
  setBoomRoomIdle,
  settleBoomRoom,
  startBoomGame
} from '../utils/boom-game.js'
import { renderMlImage } from '../utils/ml-render.js'
import { renderWordleImage } from '../utils/wordle-render.js'
import { renderRankImage } from '../utils/rank-render.js'

const loggerInstance = (typeof Bot !== 'undefined' && Bot?.logger)
  || (typeof logger !== 'undefined' ? logger : null)
  || globalThis.logger
const botInstance = typeof Bot !== 'undefined' ? Bot : globalThis.Bot
const logInfo = loggerInstance?.info?.bind(loggerInstance) || console.log
const logWarn = loggerInstance?.warn?.bind(loggerInstance) || console.warn
const segmentInstance = typeof segment !== 'undefined' ? segment : globalThis.segment

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
          reg: /^(?:\/|#)?(?:dict|查词)(?:\s+.+)?\s*$/i,
          fnc: 'lookupWordMeaning'
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
          reg: /^(?:\/|#)?(?:rank|coinrank)\s*$/i,
          fnc: 'showCoinLeaderboard'
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
          reg: /^(?:\/|#)?farm\s*$/i,
          fnc: 'showFarmMenu'
        },
        {
          reg: /^(?:\/|#)?farm\s+shop\s*$/i,
          fnc: 'showFarmShop'
        },
        {
          reg: /^(?:\/|#)?farm\s+buy\s+([a-z0-9_-]+)(?:\s+(\d+))?\s*$/i,
          fnc: 'buyFarmSeed'
        },
        {
          reg: /^(?:\/|#)?farm\s+plant\s+(\d+)\s+([a-z0-9_-]+)\s*$/i,
          fnc: 'plantFarmSeed'
        },
        {
          reg: /^(?:\/|#)?farm\s+water\s+(\d+|all)\s*$/i,
          fnc: 'waterFarmPlot'
        },
        {
          reg: /^(?:\/|#)?farm\s+harvest\s+(\d+|all)\s*$/i,
          fnc: 'harvestFarmPlot'
        },
        {
          reg: /^(?:\/|#)?farm\s+bag\s*$/i,
          fnc: 'showFarmBag'
        },
        {
          reg: /^(?:\/|#)?farm\s+sell\s+([a-z0-9_-]+)\s+(\d+|all)\s*$/i,
          fnc: 'sellFarmCrop'
        },
        {
          reg: /^(?:\/|#)?farm\s+order\s*$/i,
          fnc: 'showFarmOrders'
        },
        {
          reg: /^(?:\/|#)?farm\s+deliver\s+(\d+)\s*$/i,
          fnc: 'deliverFarmOrder'
        },
        {
          reg: /^(?:\/|#)?farm\s+addon\s*$/i,
          fnc: 'showFarmAddonStatus'
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
          reg: /^(?:\/|#)?ml\s+mode\s*$/i,
          fnc: 'showMlModeMenu'
        },
        {
          reg: /^(?:\/|#)?ml\s+mode\s+(auto|image|text)\s*$/i,
          fnc: 'setMlReplyMode'
        },
        {
          reg: /^(?:\/|#)?ml\s+(\d{4})\s*$/i,
          fnc: 'submitMlAnswer'
        },
        {
          reg: /^(?:\/|#)?(?:wordle|wd)\s*$/i,
          fnc: 'showWordleMenu'
        },
        {
          reg: /^(?:\/|#)?(?:wordle|wd)\s+start\s*$/i,
          fnc: 'startWordleGame'
        },
        {
          reg: /^(?:\/|#)?(?:wordle|wd)\s+difficulty\s*$/i,
          fnc: 'showWordleDifficultyMenu'
        },
        {
          reg: /^(?:\/|#)?(?:wordle|wd)\s+difficulty\s+(\d+)\s*$/i,
          fnc: 'setWordleDifficulty'
        },
        {
          reg: /^(?:\/|#)?(?:wordle|wd)\s+([a-zA-Z]{5})\s*$/i,
          fnc: 'submitWordleAnswer'
        },
        {
          reg: /^(?:\/|#)?boom\s*$/i,
          fnc: 'showBoomMenu'
        },
        {
          reg: /^(?:\/|#)?boom\s+difficulty\s*$/i,
          fnc: 'showBoomDifficultyMenu'
        },
        {
          reg: /^(?:\/|#)?boom\s+difficulty\s+(\d+)\s*$/i,
          fnc: 'setBoomDifficulty'
        },
        {
          reg: /^(?:\/|#)?boom\s+creat(?:e)?\s*$/i,
          fnc: 'createBoomGameRoom'
        },
        {
          reg: /^(?:\/|#)?boom\s+join\s*$/i,
          fnc: 'joinBoomGameRoom'
        },
        {
          reg: /^(?:\/|#)?boom\s+leave\s*$/i,
          fnc: 'leaveBoomGameRoom'
        },
        {
          reg: /^(?:\/|#)?boom\s+start\s*$/i,
          fnc: 'startBoomCountdown'
        },
        {
          reg: /^(?:\/|#)?boom\s+cancel\s*$/i,
          fnc: 'cancelBoomGameRoom'
        },
        {
          reg: /^(?:\/|#)?boom\s+(\d+)\s*$/i,
          fnc: 'submitBoomGuess'
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

  async lookupWordMeaning(e) {
    if (!await this.ensureUsable(e)) {
      return true
    }

    const sessionId = this.getSessionId(e)
    const selectionCommand = /查词/i.test(e.msg || '') ? '/查词' : '/dict'
    const match = (e.msg || '').match(/^(?:\/|#)?(?:dict|查词)(?:\s+(.+))?\s*$/i)
    const rawQuery = String(match?.[1] || '').trim()
    const forceSuggest = /(?:^|\s)-s$/i.test(rawQuery)
    const query = forceSuggest
      ? rawQuery.replace(/(?:^|\s)-s$/i, '').trim()
      : rawQuery

    if (!query) {
      await this.replyWithTimeout(e, [
        '/dict <词语> - 查询单词或搜索结果',
        '/dict <词语> -s - 强制进入搜索模式',
        '/dict <1-5> - 查看上一轮搜索结果详情',
        '/查词 <词语> - 查询单词或搜索结果',
        '示例: /dict arise',
        '示例: /dict 原神 -s',
        '示例: /dict 1'
      ].join('\n'), true)
      return true
    }

    if (!forceSuggest && /^[1-5]$/.test(query)) {
      const picked = pickPendingDictSelection(sessionId, e.user_id, query)

      if (!picked.ok) {
        if (picked.reason === 'out_of_range' && picked.selection?.entries?.length) {
          await this.replyWithTimeout(
            e,
            `当前搜索结果只有 ${picked.selection.entries.length} 条喵，请输入 ${selectionCommand} 1 到 ${selectionCommand} ${picked.selection.entries.length} 查看对应结果`,
            true
          )
          return true
        }

        await this.replyWithTimeout(e, '没有可继续查看的搜索结果喵，请先重新搜索一下吧~', true)
        return true
      }

      const detailEntry = picked.entry?.entry || ''
      if (!detailEntry || isBlockedSexualWord(detailEntry)) {
        await this.replyWithTimeout(e, '这个候选词有点涩涩，不给查喵，换一个正常点的词吧~', true)
        return true
      }

      const detailText = await resolveWordSuggestionDetail(picked.entry, {
        onLookupError: (source, detailQuery, error) => {
          logWarn(`[neow][dict] 查询候选${source === 'explain' ? '释义' : ''} ${String(detailQuery || '').toLowerCase()} 失败: ${error?.message || error}`)
        }
      })
      if (!detailText) {
        await this.replyWithTimeout(e, `${detailEntry} 暂时没有更详细的释义喵，换一个结果试试看吧~`, true)
        return true
      }

      clearPendingDictSelection(sessionId, e.user_id)
      await this.replyWithTimeout(e, detailText, true)
      return true
    }

    if (isBlockedSexualWord(query)) {
      clearPendingDictSelection(sessionId, e.user_id)
      await this.replyWithTimeout(e, '这个词有点涩涩，不给查喵，换一个正常点的单词吧~', true)
      return true
    }

    let replyText = ''

    if (!forceSuggest) {
      const meaning = await fetchWordleMeaning(query, {
        onError: error => {
          logWarn(`[neow][dict] 查询 ${String(query || '').toLowerCase()} 释义失败: ${error?.message || error}`)
        }
      })

      replyText = formatWordLookupBlock(meaning)
    }

    if (replyText) {
      clearPendingDictSelection(sessionId, e.user_id)
    }

    if (!replyText) {
      const suggestions = await fetchWordSuggestions(query, {
        onError: error => {
          logWarn(`[neow][dict] 查询 ${String(query || '').toLowerCase()} 搜索结果失败: ${error?.message || error}`)
        }
      })

      const suggestionText = formatWordSuggestionBlock(suggestions)
      if (suggestionText) {
        setPendingDictSelection(sessionId, e.user_id, suggestions)
        replyText = [
          suggestionText,
          '',
          `再次输入 ${selectionCommand} 1 即可查看第 1 条详细意思`
        ].join('\n')
      }
    }

    if (!replyText) {
      clearPendingDictSelection(sessionId, e.user_id)
      await this.replyWithTimeout(e, '大喵喵暂时没查到这个单词喵，换一个试试看吧~', true)
      return true
    }

    await this.replyWithTimeout(e, replyText, true)
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

  async showCoinLeaderboard(e) {
    if (!await this.ensureUsable(e)) {
      return true
    }

    getUserData(e.user_id)

    const leaderboard = getCoinLeaderboard({
      limit: 10,
      userId: e.user_id
    })
    const fallbackText = this.buildCoinLeaderboardText(leaderboard, e.user_id)
    const card = this.buildCoinLeaderboardCard(leaderboard)

    return this.replyRankCard(e, card, fallbackText)
  }

  buildCoinLeaderboardText(leaderboard, userId) {
    const lines = [
      'Star 币排行榜',
      leaderboard.totalUsers > leaderboard.entries.length
        ? `当前展示前 ${leaderboard.entries.length} 名，共 ${leaderboard.totalUsers} 位用户`
        : `当前共 ${leaderboard.totalUsers} 位用户`,
      ''
    ]

    leaderboard.entries.forEach(entry => {
      const selfTag = entry.userId === String(userId) ? '（你）' : ''
      lines.push(`${entry.rank}. ${entry.name} - ${entry.coins} 枚 Star 币${selfTag}`)
    })

    if (leaderboard.currentUser) {
      lines.push('', `你当前第 ${leaderboard.currentUser.rank} 名`)

      if (leaderboard.currentUser.rank > leaderboard.entries.length) {
        lines.push(`${leaderboard.currentUser.name} - ${leaderboard.currentUser.coins} 枚 Star 币`)
      }
    }

    return lines.join('\n')
  }

  buildCoinLeaderboardCard(leaderboard) {
    const currentUser = leaderboard.currentUser && leaderboard.currentUser.rank > leaderboard.entries.length
      ? {
          rank: leaderboard.currentUser.rank,
          name: leaderboard.currentUser.name,
          coins: leaderboard.currentUser.coins
        }
      : null

    return {
      title: 'Star 币排行榜',
      subtitle: '看看谁是大富翁',
      entries: leaderboard.entries.map(entry => ({
        rank: entry.rank,
        name: entry.name,
        coins: entry.coins
      })),
      currentUser,
      footerText: 'q3cc-neow-plugin'
    }
  }

  getMlReplyModeDetails(savedMode, difficultyId) {
    const parsedDifficultyId = Number(difficultyId)
    const normalizedDifficultyId = Number.isInteger(parsedDifficultyId) ? parsedDifficultyId : null
    const normalizedMode = normalizeMlReplyMode(savedMode)
    const resolvedMode = resolveMlReplyMode(normalizedMode, normalizedDifficultyId)
    const forceText = normalizedDifficultyId === ML_FORCE_TEXT_DIFFICULTY
    const forcedDifficultyName = ML_DIFFICULTIES[ML_FORCE_TEXT_DIFFICULTY]?.name || '另类极限'

    return {
      savedMode: normalizedMode,
      resolvedMode,
      forceText,
      savedLabel: ML_REPLY_MODES[normalizedMode].name,
      resolvedLabel: ML_REPLY_MODES[resolvedMode].name,
      currentLabel: forceText
        ? `${ML_REPLY_MODES[resolvedMode].name}（${forcedDifficultyName}强制）`
        : ML_REPLY_MODES[resolvedMode].name,
      forceTextLine: forceText
        ? `当前难度为 ${forcedDifficultyName}, 会强制使用文字发送`
        : ''
    }
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

  async getFarmContext(e) {
    const registry = getFarmRegistry()
    if (!registry.cropList.length) {
      await this.replyWithTimeout(e, '农田系统还没准备好喵，稍后再来看看吧~', true)
      return null
    }

    return {
      registry,
      state: getFarmState(e.user_id),
      user: getUserData(e.user_id),
      now: Date.now()
    }
  }

  formatFarmDuration(ms) {
    const remainingMs = Math.max(0, Number(ms) || 0)
    const totalSeconds = Math.ceil(remainingMs / 1000)
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60

    if (hours > 0) {
      return minutes > 0 ? `${hours}小时${minutes}分钟` : `${hours}小时`
    }

    if (minutes > 0) {
      return seconds > 0 ? `${minutes}分钟${seconds}秒` : `${minutes}分钟`
    }

    return `${seconds}秒`
  }

  formatFarmSourceName(source) {
    const raw = String(source || '')
    const parts = raw.split(/[\\/]/)
    return parts[parts.length - 1] || raw
  }

  getFarmPlotRemainingMs(plot, now = Date.now()) {
    if (!plot?.cropAlias) {
      return 0
    }

    return Math.max(0, (plot.readyAt || 0) - now)
  }

  formatFarmPlotLine(plot, now = Date.now()) {
    if (!plot?.cropAlias) {
      return `${plot.plotId}号地: 空地`
    }

    const remainingMs = this.getFarmPlotRemainingMs(plot, now)
    const wateredText = plot.watered ? ' (已浇水)' : ''

    if (remainingMs <= 0) {
      return `${plot.plotId}号地: ${plot.nameSnapshot} - 已成熟${wateredText}`
    }

    return `${plot.plotId}号地: ${plot.nameSnapshot} - 剩余 ${this.formatFarmDuration(remainingMs)}${wateredText}`
  }

  formatFarmOrderLine(order, index, now = Date.now()) {
    if (!order) {
      return `${index + 1}. 暂无订单`
    }

    const expiresMs = Math.max(0, (order.expiresAt || 0) - now)
    return `${index + 1}. ${order.cropNameSnapshot} x${order.requiredQty} -> ${order.coinReward} Star 币 + ${order.favorReward} 好感度 (剩余 ${this.formatFarmDuration(expiresMs)})`
  }

  formatFarmSeedLine(entry) {
    return `${entry.cropAlias} - ${entry.seedNameSnapshot || `${entry.nameSnapshot}种子`} x${entry.count}`
  }

  formatFarmCropLine(entry) {
    return `${entry.cropAlias} - ${entry.nameSnapshot} x${entry.count} (卖出 ${entry.sellPriceSnapshot}/个)`
  }

  async showFarmMenu(e) {
    if (!await this.ensureUsable(e)) {
      return true
    }

    const farm = await this.getFarmContext(e)
    if (!farm) {
      return true
    }

    const { registry, state, user, now } = farm
    const plotLines = state.plots.map(plot => this.formatFarmPlotLine(plot, now))
    const totalSeedCount = Object.values(state.seeds).reduce((sum, entry) => sum + entry.count, 0)
    const totalCropCount = Object.values(state.crops).reduce((sum, entry) => sum + entry.count, 0)
    const adminLines = isTemporaryAdmin(user)
      ? ['', '/farm addon - 查看附加件状态']
      : []

    await this.replyWithTimeout(e, [
      '大喵喵的小农田开张啦喵~',
      `当前 Star 币: ${user.coins}`,
      `⚡ 当前体力: ${user.stamina}/${user.maxStamina}`,
      `🌱 已加载作物: ${registry.cropList.length} 种`,
      `📦 背包概况: ${totalSeedCount} 颗种子 / ${totalCropCount} 个作物`,
      `📋 订单板刷新: ${this.formatFarmDuration(Math.max(0, state.orderBoardExpiresAt - now))}`,
      '',
      '地块状态:',
      ...plotLines,
      '',
      '/farm shop - 查看种子商店',
      '/farm bag - 查看背包',
      '/farm order - 查看订单板',
      '/farm harvest all - 一键收成熟作物',
      ...adminLines
    ].join('\n'), true)

    return true
  }

  async showFarmShop(e) {
    if (!await this.ensureUsable(e)) {
      return true
    }

    const farm = await this.getFarmContext(e)
    if (!farm) {
      return true
    }

    const { registry, user } = farm

    await this.replyWithTimeout(e, [
      '农场商店',
      `当前 Star 币: ${user.coins}`,
      '使用 /farm buy <作物别名> [数量] 购买种子',
      '',
      ...registry.cropList.map(crop =>
        `${crop.alias} - ${crop.seedName} ${crop.seedPrice} Star 币 | ${crop.growMinutes}分钟成熟 | 卖出 ${crop.sellPrice}`
      ),
      '',
      '示例: /farm buy radish 2'
    ].join('\n'), true)

    return true
  }

  async buyFarmSeed(e) {
    if (!await this.ensureUsable(e)) {
      return true
    }

    const farm = await this.getFarmContext(e)
    if (!farm) {
      return true
    }

    const match = (e.msg || '').match(/^(?:\/|#)?farm\s+buy\s+([a-z0-9_-]+)(?:\s+(\d+))?\s*$/i)
    const cropAlias = String(match?.[1] || '').trim().toLowerCase()
    const count = match?.[2] ? parseInt(match[2]) : 1
    const preview = buySeeds(farm.state, cropAlias, count, { preview: true })

    if (!preview.ok) {
      await this.replyWithTimeout(e, preview.reason === 'unknown_crop'
        ? '这个作物别名不存在喵，先用 /farm shop 看看商店吧~'
        : '购买数量必须是大于 0 的整数喵~', true)
      return true
    }

    if (farm.user.coins < preview.totalCost) {
      await this.replyWithTimeout(e, [
        'Star 币不够买种子喵~',
        `当前拥有: ${farm.user.coins}`,
        `需要花费: ${preview.totalCost}`
      ].join('\n'), true)
      return true
    }

    const result = buySeeds(farm.state, cropAlias, count)
    farm.user.coins -= result.totalCost
    syncUserData(farm.user, { persist: true })
    await saveFarmData()

    await this.replyWithTimeout(e, [
      '买种子成功喵~',
      `购入: ${result.crop.seedName} x${result.count}`,
      `花费: ${result.totalCost} Star 币`,
      `剩余 Star 币: ${farm.user.coins}`,
      `当前持有: ${result.inventoryCount} 颗`
    ].join('\n'), true)

    return true
  }

  async plantFarmSeed(e) {
    if (!await this.ensureUsable(e)) {
      return true
    }

    const farm = await this.getFarmContext(e)
    if (!farm) {
      return true
    }

    const match = (e.msg || '').match(/^(?:\/|#)?farm\s+plant\s+(\d+)\s+([a-z0-9_-]+)\s*$/i)
    const plotId = parseInt(match?.[1])
    const cropAlias = String(match?.[2] || '').trim().toLowerCase()
    const preview = plantSeed(farm.state, plotId, cropAlias, farm.now, { preview: true })

    if (!preview.ok) {
      let message = '播种失败喵~'

      if (preview.reason === 'plot_out_of_range') {
        message = `地块编号不对喵，目前只有 1-${farm.state.plots.length} 号地`
      } else if (preview.reason === 'plot_occupied') {
        message = `${plotId}号地已经种着东西啦，先收掉再播种吧~`
      } else if (preview.reason === 'unknown_crop') {
        message = '这个作物别名不存在喵，先用 /farm shop 看看商店吧~'
      } else if (preview.reason === 'seed_missing') {
        message = `背包里没有 ${preview.crop?.seedName || cropAlias} 了喵，先去 /farm shop 买点吧~`
      }

      await this.replyWithTimeout(e, message, true)
      return true
    }

    if (farm.user.stamina < preview.staminaCost) {
      await this.replyWithTimeout(e, [
        '体力不够播种喵~',
        `当前体力: ${farm.user.stamina}/${farm.user.maxStamina}`,
        `需要体力: ${preview.staminaCost}`
      ].join('\n'), true)
      return true
    }

    const result = plantSeed(farm.state, plotId, cropAlias, farm.now)
    farm.user.stamina -= result.staminaCost
    syncUserData(farm.user, { persist: true })
    await saveFarmData()

    await this.replyWithTimeout(e, [
      '播种完成喵~',
      `${result.plot.plotId}号地已经种下 ${result.crop.name}`,
      `消耗体力: ${result.staminaCost}`,
      `预计成熟: ${new Date(result.readyAt).toLocaleString('zh-CN')}`
    ].join('\n'), true)

    return true
  }

  async waterFarmPlot(e) {
    if (!await this.ensureUsable(e)) {
      return true
    }

    const farm = await this.getFarmContext(e)
    if (!farm) {
      return true
    }

    const match = (e.msg || '').match(/^(?:\/|#)?farm\s+water\s+(\d+|all)\s*$/i)
    const target = String(match?.[1] || '').trim().toLowerCase()
    const preview = waterPlots(farm.state, target, farm.now, { preview: true })

    if (!preview.ok) {
      let message = '现在没有能浇水的地块喵~'

      if (preview.reason === 'plot_out_of_range') {
        message = `地块编号不对喵，目前只有 1-${farm.state.plots.length} 号地`
      } else if (preview.reason === 'plot_empty') {
        message = '这块地还是空的喵，先播种再浇水吧~'
      } else if (preview.reason === 'already_ready') {
        message = '这块地已经熟啦，直接 /farm harvest 收掉就好喵~'
      } else if (preview.reason === 'already_watered') {
        message = '这块地这轮已经浇过水啦喵~'
      }

      await this.replyWithTimeout(e, message, true)
      return true
    }

    if (farm.user.stamina < preview.staminaCost) {
      await this.replyWithTimeout(e, [
        '体力不够浇水喵~',
        `当前体力: ${farm.user.stamina}/${farm.user.maxStamina}`,
        `需要体力: ${preview.staminaCost}`
      ].join('\n'), true)
      return true
    }

    const result = waterPlots(farm.state, target, farm.now)
    farm.user.stamina -= result.staminaCost
    syncUserData(farm.user, { persist: true })
    await saveFarmData()

    await this.replyWithTimeout(e, [
      '浇水完成喵~',
      `照料地块: ${result.plots.map(plot => `${plot.plotId}号地`).join('、')}`,
      `消耗体力: ${result.staminaCost}`,
      ...result.plots.map(plot =>
        `${plot.plotId}号地 ${plot.nameSnapshot} 还剩 ${this.formatFarmDuration(Math.max(0, plot.readyAt - farm.now))}`
      )
    ].join('\n'), true)

    return true
  }

  async harvestFarmPlot(e) {
    if (!await this.ensureUsable(e)) {
      return true
    }

    const farm = await this.getFarmContext(e)
    if (!farm) {
      return true
    }

    const match = (e.msg || '').match(/^(?:\/|#)?farm\s+harvest\s+(\d+|all)\s*$/i)
    const target = String(match?.[1] || '').trim().toLowerCase()
    const result = harvestPlots(farm.state, target, farm.now)

    if (!result.ok) {
      let message = '现在还没有能收的作物喵~'

      if (result.reason === 'plot_out_of_range') {
        message = `地块编号不对喵，目前只有 1-${farm.state.plots.length} 号地`
      } else if (result.reason === 'plot_empty') {
        message = '这块地还是空的喵，没东西可以收~'
      } else if (result.reason === 'not_ready') {
        message = '这块地还没熟喵，再等等吧~'
      }

      await this.replyWithTimeout(e, message, true)
      return true
    }

    await saveFarmData()
    await this.replyWithTimeout(e, [
      '收获完成喵~',
      ...result.harvested.map(item =>
        `${item.plotId}号地收到了 ${item.nameSnapshot} x${item.count}`
      )
    ].join('\n'), true)

    return true
  }

  async showFarmBag(e) {
    if (!await this.ensureUsable(e)) {
      return true
    }

    const farm = await this.getFarmContext(e)
    if (!farm) {
      return true
    }

    const seedEntries = Object.values(farm.state.seeds)
      .sort((left, right) => left.cropAlias.localeCompare(right.cropAlias, 'en'))
    const cropEntries = Object.values(farm.state.crops)
      .sort((left, right) => left.cropAlias.localeCompare(right.cropAlias, 'en'))

    await this.replyWithTimeout(e, [
      '农场背包',
      '',
      '种子:',
      ...(seedEntries.length ? seedEntries.map(entry => `  ${this.formatFarmSeedLine(entry)}`) : ['  暂时没有种子喵~']),
      '',
      '作物:',
      ...(cropEntries.length ? cropEntries.map(entry => `  ${this.formatFarmCropLine(entry)}`) : ['  暂时没有作物喵~']),
      '',
      '卖出示例: /farm sell radish all'
    ].join('\n'), true)

    return true
  }

  async showFarmOrders(e) {
    if (!await this.ensureUsable(e)) {
      return true
    }

    const farm = await this.getFarmContext(e)
    if (!farm) {
      return true
    }

    await this.replyWithTimeout(e, [
      '农场订单板',
      `刷新剩余: ${this.formatFarmDuration(Math.max(0, farm.state.orderBoardExpiresAt - farm.now))}`,
      '',
      ...Array.from({ length: 3 }, (_, index) => this.formatFarmOrderLine(farm.state.orders[index], index, farm.now)),
      '',
      '交付示例: /farm deliver 1'
    ].join('\n'), true)

    return true
  }

  async sellFarmCrop(e) {
    if (!await this.ensureUsable(e)) {
      return true
    }

    const farm = await this.getFarmContext(e)
    if (!farm) {
      return true
    }

    const match = (e.msg || '').match(/^(?:\/|#)?farm\s+sell\s+([a-z0-9_-]+)\s+(\d+|all)\s*$/i)
    const cropAlias = String(match?.[1] || '').trim().toLowerCase()
    const count = String(match?.[2] || '').trim().toLowerCase()
    const result = sellCrops(farm.state, cropAlias, count)

    if (!result.ok) {
      let message = '卖出失败喵~'

      if (result.reason === 'inventory_missing') {
        message = `背包里没有 ${cropAlias} 对应的作物喵~`
      } else if (result.reason === 'invalid_count') {
        message = '卖出数量必须是正整数，或者直接写 all 喵~'
      } else if (result.reason === 'insufficient_inventory') {
        message = `背包里只剩 ${result.available} 个，不够卖这么多喵~`
      }

      await this.replyWithTimeout(e, message, true)
      return true
    }

    farm.user.coins += result.coinReward
    syncUserData(farm.user, { persist: true })
    await saveFarmData()

    await this.replyWithTimeout(e, [
      '卖出成功喵~',
      `卖出: ${result.cropNameSnapshot} x${result.soldCount}`,
      `获得: ${result.coinReward} Star 币`,
      `当前 Star 币: ${farm.user.coins}`
    ].join('\n'), true)

    return true
  }

  async deliverFarmOrder(e) {
    if (!await this.ensureUsable(e)) {
      return true
    }

    const farm = await this.getFarmContext(e)
    if (!farm) {
      return true
    }

    const match = (e.msg || '').match(/^(?:\/|#)?farm\s+deliver\s+(\d+)\s*$/i)
    const orderIndex = parseInt(match?.[1])
    const result = deliverOrder(farm.state, orderIndex, farm.now)

    if (!result.ok) {
      let message = '交付失败喵~'

      if (result.reason === 'order_missing') {
        message = '这个订单编号不存在喵，先用 /farm order 看看吧~'
      } else if (result.reason === 'insufficient_inventory') {
        message = `背包里只有 ${result.available} 个 ${result.order?.cropNameSnapshot || ''}，不够交订单喵~`
      }

      await this.replyWithTimeout(e, message, true)
      return true
    }

    farm.user.coins += result.coinReward
    farm.user.favor += result.favorReward
    syncUserData(farm.user, { persist: true })
    await saveFarmData()

    const lines = [
      '订单完成啦喵~',
      `交付: ${result.order.cropNameSnapshot} x${result.order.requiredQty}`,
      `获得: ${result.coinReward} Star 币 + ${result.favorReward} 好感度`,
      `当前 Star 币: ${farm.user.coins}`
    ]

    if (result.replacement) {
      lines.push(`新订单: ${this.formatFarmOrderLine(result.replacement, result.replacement.slot - 1, farm.now)}`)
    }

    await this.replyWithTimeout(e, lines.join('\n'), true)
    return true
  }

  async showFarmAddonStatus(e) {
    if (!await this.ensureUsable(e)) {
      return true
    }

    if (!await this.ensureAdmin(e)) {
      return true
    }

    const status = getFarmAddonStatus()
    const lines = [
      'farm 附加件状态',
      `监听目录: ${status.addonDirPath}`,
      `热重载: ${status.watching ? '已开启' : '未开启'}`,
      `上次重载原因: ${status.lastReloadReason || '暂无'}`,
      `上次成功重载: ${status.lastSuccessfulReloadAt ? new Date(status.lastSuccessfulReloadAt).toLocaleString('zh-CN') : '暂无'}`,
      `已加载附加件: ${status.loadedAddons.length} 个`
    ]

    if (status.loadedAddons.length) {
      lines.push('', '已加载列表:')
      lines.push(...status.loadedAddons.map((addon, index) =>
        `${index + 1}. ${addon.id} (${addon.version}) - ${this.formatFarmSourceName(addon.source)}`
      ))
    }

    if (status.skippedAddons.length) {
      lines.push('', '被跳过的包:')
      lines.push(...status.skippedAddons.slice(0, 8).map((item, index) =>
        `${index + 1}. ${item.id || this.formatFarmSourceName(item.source)} - ${item.reason}`
      ))

      if (status.skippedAddons.length > 8) {
        lines.push(`... 还有 ${status.skippedAddons.length - 8} 条`)
      }
    }

    if (status.lastReloadError) {
      lines.push('', `最近错误: ${status.lastReloadError}`)
    }

    await this.replyWithTimeout(e, lines.join('\n'), true)
    return true
  }

  async showMlMenu(e) {
    if (!await this.ensureUsable(e)) {
      return true
    }

    const user = getUserData(e.user_id)
    const difficulty = ML_DIFFICULTIES[user.mlDifficulty] || ML_DIFFICULTIES[1]
    const modeInfo = this.getMlReplyModeDetails(user.mlReplyMode, user.mlDifficulty)

    const lines = [
      '你在整理旧物的时候，翻出了一台布满灰尘的破译机。',
      '大喵喵拍了拍机身，屏幕竟然真的亮了起来喵~',
      '只要成功破译密码，好像就能得到一点奖励呢。',
      `⚡ 当前体力: ${user.stamina}/${user.maxStamina}`,
      `📨 当前发送: ${modeInfo.currentLabel}`
    ]

    await this.replyMlCard(e, {
      title: '密码破译',
      subtitle: '旧机器已经亮起来啦喵，来试试看能不能把密码拆开吧~',
      theme: 'info',
      chips: [
        `当前体力 ${user.stamina}/${user.maxStamina}`,
        `${difficulty.name}难度`,
        `${difficulty.stamina}体力/局`,
        `${modeInfo.currentLabel}发送`
      ],
      lines,
      footerLines: [
        '/ml start - 开始游戏',
        '/ml difficulty - 修改难度',
        '/ml mode - 调整发送方式'
      ]
    }, [
      ...lines,
      '',
      `⚡ 当前体力: ${user.stamina}/${user.maxStamina} (${difficulty.stamina}体力/局)`,
      '/ml start - 开始游戏',
      '/ml difficulty - 修改难度',
      '/ml mode - 调整发送方式'
    ].join('\n'), '', user.mlDifficulty)

    return true
  }

  async startMlGame(e) {
    if (!await this.ensureUsable(e)) {
      return true
    }

    const sessionId = this.getSessionId(e)
    if (!this.ensureNoBoomConflict(e, sessionId, '开启密码破译', '/boom - 查看数字炸弹房间状态')) {
      return true
    }

    const active24Game = getActiveGame(sessionId, e.user_id)
    if (active24Game) {
      await e.reply([
        '主人现在正在玩 24 点喵~',
        '先完成当前的 `/24g answer ...`，再来开启密码破译吧~'
      ].join('\n'), true)
      return true
    }

    const activeWordleGame = getWordleGame(sessionId, e.user_id)
    if (activeWordleGame) {
      await e.reply([
        '主人现在正在玩猜单词喵~',
        '先把这局 `/wordle` 结束掉，再来开启密码破译吧~'
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
    const modeInfo = this.getMlReplyModeDetails(user.mlReplyMode, user.mlDifficulty)

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

    await this.replyMlCard(e, {
      title: '密码破译开始喵~',
      subtitle: '大喵喵已经把四位密码锁好了，快来试第一下吧~',
      theme: 'warn',
      chips: [
        `${difficulty.name}难度`,
        `${difficulty.stamina}体力/局`,
        `${modeInfo.currentLabel}发送`
      ],
      lines: [
        '我已经把四位密码锁好了。',
        `当前发送: ${modeInfo.currentLabel}`,
        '请使用 /ml <任意四位数字> 开始破译',
        '例如: /ml 1234'
      ],
      footerLines: [
        '/ml 1234',
        '/ml start - 再来一局',
        '/ml mode - 调整发送方式'
      ]
    }, [
      '密码破译开始喵~',
      '我已经把四位密码锁好了。',
      `当前发送: ${modeInfo.currentLabel}`,
      '请使用 /ml <任意四位数字> 开始破译',
      '例如: /ml 1234'
    ].join('\n'), '', user.mlDifficulty)

    return true
  }

  async showMlDifficultyMenu(e) {
    if (!await this.ensureUsable(e)) {
      return true
    }

    const user = getUserData(e.user_id)
    const difficulty = ML_DIFFICULTIES[user.mlDifficulty] || ML_DIFFICULTIES[1]
    const modeInfo = this.getMlReplyModeDetails(user.mlReplyMode, user.mlDifficulty)

    const difficultyLines = Object.entries(ML_DIFFICULTIES).map(([, item]) => `${item.name}: ${item.desc}`)

    await this.replyMlCard(e, {
      title: '密码破译难度菜单',
      subtitle: '不同难度会影响时限、机会和奖励喵~',
      theme: 'info',
      chips: [
        `当前难度 ${difficulty.name}`,
        `${difficulty.stamina}体力/局`,
        `${modeInfo.currentLabel}发送`
      ],
      lines: [
        `当前发送: ${modeInfo.currentLabel}`,
        ...difficultyLines
      ],
      footerLines: [
        '所选难度越高, 消耗体力越多, 奖励越丰富',
        '/ml mode - 调整发送方式',
        '/ml difficulty 0 - 简单',
        '/ml difficulty 1 - 普通',
        '/ml difficulty 2 - 困难',
        '/ml difficulty 3 - 极限',
        '/ml difficulty 4 - 另类极限'
      ]
    }, [
      `主人当前的难度为: ${difficulty.name}`,
      `当前发送: ${modeInfo.currentLabel}`,
      '',
      ...difficultyLines,
      '',
      '所选难度越高, 消耗体力越多, 奖励越丰富',
      '/ml mode - 调整发送方式',
      '/ml difficulty 0 - 简单',
      '/ml difficulty 1 - 普通',
      '/ml difficulty 2 - 困难',
      '/ml difficulty 3 - 极限',
      '/ml difficulty 4 - 另类极限'
    ].join('\n'), '', user.mlDifficulty)
    return true
  }

  async showMlModeMenu(e) {
    if (!await this.ensureUsable(e)) {
      return true
    }

    const user = getUserData(e.user_id)
    const difficulty = ML_DIFFICULTIES[user.mlDifficulty] || ML_DIFFICULTIES[1]
    const modeInfo = this.getMlReplyModeDetails(user.mlReplyMode, user.mlDifficulty)

    const lines = [
      `当前设置: ${modeInfo.savedLabel}`,
      `当前实际发送: ${modeInfo.currentLabel}`,
      `当前难度: ${difficulty.name}`
    ]

    if (modeInfo.forceText) {
      lines.push('当前难度为另类极限, 会强制使用文字发送喵~')
      lines.push(`离开另类极限后, 会恢复为 ${modeInfo.savedLabel} 方式发送`)
    } else {
      lines.push('自动模式会优先发送图片, 失败时再改发文字喵~')
    }

    lines.push(
      '',
      '/ml mode auto - 自动 (优先图片, 失败时转文字)',
      '/ml mode image - 图片 (优先尝试图片, 失败时仍转文字)',
      '/ml mode text - 文字 (直接发送文字)'
    )

    await this.replyMlCard(e, {
      title: '密码破译发送方式',
      subtitle: '主人可以自己决定更喜欢看图片还是文字喵~',
      theme: 'info',
      chips: [
        `${difficulty.name}难度`,
        `当前设置 ${modeInfo.savedLabel}`,
        `实际发送 ${modeInfo.currentLabel}`
      ],
      lines,
      footerLines: [
        '/ml mode auto - 自动',
        '/ml mode image - 图片',
        '/ml mode text - 文字'
      ]
    }, lines.join('\n'), '', user.mlDifficulty)

    return true
  }

  async setMlReplyMode(e) {
    if (!await this.ensureUsable(e)) {
      return true
    }

    const match = (e.msg || '').match(/^(?:\/|#)?ml\s+mode\s+(auto|image|text)\s*$/i)
    const nextMode = normalizeMlReplyMode(match?.[1])
    const user = getUserData(e.user_id)

    user.mlReplyMode = nextMode
    saveUserData()

    const difficulty = ML_DIFFICULTIES[user.mlDifficulty] || ML_DIFFICULTIES[1]
    const modeInfo = this.getMlReplyModeDetails(user.mlReplyMode, user.mlDifficulty)
    const lines = [
      `密码破译发送方式已设置为: ${modeInfo.savedLabel}`,
      `当前实际发送: ${modeInfo.currentLabel}`,
      `当前难度: ${difficulty.name}`
    ]

    if (modeInfo.forceText) {
      lines.push('因为当前是另类极限, 所以这局相关提示仍会直接使用文字发送喵~')
    } else {
      lines.push(ML_REPLY_MODES[modeInfo.savedMode].desc)
    }

    lines.push('/ml start - 开始游戏')
    lines.push('/ml mode - 查看发送方式菜单')

    await this.replyMlCard(e, {
      title: '发送方式设置完成',
      subtitle: '大喵喵已经记住主人喜欢的展示方式啦喵~',
      theme: 'success',
      chips: [
        `${difficulty.name}难度`,
        `当前设置 ${modeInfo.savedLabel}`,
        `实际发送 ${modeInfo.currentLabel}`
      ],
      lines: lines.slice(0, 4),
      footerLines: [
        '/ml start - 开始游戏',
        '/ml mode - 查看发送方式菜单'
      ]
    }, lines.join('\n'), '', user.mlDifficulty)

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
    const modeInfo = this.getMlReplyModeDetails(user.mlReplyMode, difficultyId)
    await this.replyMlCard(e, {
      title: '难度设置完成',
      subtitle: '大喵喵已经把破译机调到新的模式啦喵~',
      theme: 'success',
      chips: [
        `${difficulty.name}难度`,
        `${difficulty.stamina}体力/局`,
        `${modeInfo.currentLabel}发送`
      ],
      lines: [
        difficulty.desc,
        `消耗体力: ${difficulty.stamina}`,
        `当前发送: ${modeInfo.currentLabel}`
      ],
      footerLines: [
        '/ml start - 开始游戏',
        '/ml difficulty - 查看难度菜单',
        '/ml mode - 查看发送方式菜单'
      ]
    }, [
      `密码破译难度已设置为: ${difficulty.name}`,
      difficulty.desc,
      `消耗体力: ${difficulty.stamina}`,
      `当前发送: ${modeInfo.currentLabel}`,
      modeInfo.forceTextLine
    ].filter(Boolean).join('\n'), '', difficultyId)
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
      const { penaltyLine } = this.applyMlFailurePenalty(e.user_id, difficulty)
      const lines = [
        '密码破译 - 失败',
        ...formatMlHistory(game.history),
        `时间到啦喵... 正确答案是 ${game.password}`,
        penaltyLine,
        '/ml start - 再来一次'
      ]
      deleteMlGame(sessionId, e.user_id)
      await this.replyMlCard(e, {
        title: '密码破译 - 失败',
        subtitle: '时间到啦喵，这台老机器已经不肯再等啦~',
        theme: 'danger',
        chips: [
          `${difficulty.name}难度`,
          '时间耗尽'
        ],
        history: game.history,
        summaryLines: [
          `正确答案是 ${game.password}`
        ],
        footerLines: [
          '/ml start - 再来一次'
        ]
      }, lines.join('\n'), [
        `时间到啦喵... 正确答案是 ${game.password}`,
        penaltyLine,
        '/ml start - 再来一次'
      ].join('\n'), game.difficulty)
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
      await this.replyMlCard(e, {
        title: '密码破译 - 成功',
        subtitle: '喀哒一声，锁芯真的被主人拆开啦喵~',
        theme: 'success',
        chips: [
          `${difficulty.name}难度`,
          `共 ${game.history.length} 次`
        ],
        history: game.history,
        summaryLines: [
          `总共试了 ${game.history.length} 次`,
          `获得 ${rewards.coinReward} 枚 Star 币`,
          `获得来自大喵喵的 ${rewards.favorReward} 点好感度`
        ],
        footerLines: [
          '/ml start - 再来一次'
        ]
      }, lines.join('\n'), [
        `总共试了 ${game.history.length} 次`,
        `游戏机吐出了 ${rewards.coinReward} 枚 Star 币, 同时还获得了来自大喵喵的 ${rewards.favorReward} 点好感度`,
        '/ml start - 再来一次'
      ].join('\n'), game.difficulty)
      return true
    }

    if (shouldMlExplode(game, difficulty)) {
      const { penaltyLine } = this.applyMlFailurePenalty(e.user_id, difficulty)
      const lines = [
        '密码破译 - 失败',
        ...formatMlHistory(game.history),
        '第 5 次答错后，老旧的机器突然冒出一阵黑烟，直接炸机了喵...',
        `正确答案是 ${game.password}`,
        penaltyLine,
        '/ml start - 再来一次'
      ]
      deleteMlGame(sessionId, e.user_id)
      await this.replyMlCard(e, {
        title: '密码破译 - 失败',
        subtitle: '这台老机器被你逼急了，直接炸机给你看喵...',
        theme: 'danger',
        chips: [
          `${difficulty.name}难度`,
          '炸机失败'
        ],
        history: game.history,
        summaryLines: [
          '第 5 次答错后，老旧的机器突然冒出一阵黑烟，直接炸机了喵...',
          `正确答案是 ${game.password}`
        ],
        footerLines: [
          '/ml start - 再来一次'
        ]
      }, lines.join('\n'), [
        '第 5 次答错后，老旧的机器突然冒出一阵黑烟，直接炸机了喵...',
        `正确答案是 ${game.password}`,
        penaltyLine,
        '/ml start - 再来一次'
      ].join('\n'), game.difficulty)
      return true
    }

    if (difficulty.maxAttempts && game.history.length >= difficulty.maxAttempts) {
      const { penaltyLine } = this.applyMlFailurePenalty(e.user_id, difficulty)
      const lines = [
        '密码破译 - 失败',
        ...formatMlHistory(game.history),
        `次数用完啦... 正确答案是 ${game.password}`,
        penaltyLine,
        '/ml start - 再来一次'
      ]
      deleteMlGame(sessionId, e.user_id)
      await this.replyMlCard(e, {
        title: '密码破译 - 失败',
        subtitle: '机会已经用完了喵，这次只能先看到这里啦~',
        theme: 'danger',
        chips: [
          `${difficulty.name}难度`,
          `已用 ${game.history.length} 次`
        ],
        history: game.history,
        summaryLines: [
          `次数用完啦... 正确答案是 ${game.password}`
        ],
        footerLines: [
          '/ml start - 再来一次'
        ]
      }, lines.join('\n'), [
        `次数用完啦... 正确答案是 ${game.password}`,
        penaltyLine,
        '/ml start - 再来一次'
      ].join('\n'), game.difficulty)
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

    await this.replyMlCard(e, {
      title: remainSeconds !== null ? '密码破译 - 剩余时间' : '密码破译 - 正在进行',
      subtitle: '继续试试看吧喵，也许下一次就能戳中真正的密码了~',
      theme: 'info',
      chips: [
        `${difficulty.name}难度`,
        remainSeconds !== null ? `剩余 ${remainSeconds} 秒` : '无时间限制',
        `已尝试 ${game.history.length} 次`
      ],
      history: game.history,
      footerLines: [
        '使用: /ml <任意四位数字> 以继续破译',
        '例如: /ml 1234'
      ]
    }, lines.join('\n'), remainSeconds !== null
      ? `剩余时间 ${remainSeconds} 秒`
      : `已尝试 ${game.history.length} 次`, game.difficulty)
    return true
  }

  async showWordleMenu(e) {
    if (!await this.ensureUsable(e)) {
      return true
    }

    const user = getUserData(e.user_id)
    const difficulty = WORDLE_DIFFICULTIES[user.wordleDifficulty] || WORDLE_DIFFICULTIES[1]

    await e.reply([
      '来和大喵喵玩 Wordle 猜单词喵~',
      '我会藏好一个 5 字母英文单词，主人来把它找出来吧~',
      '',
      `⚡ 当前体力: ${user.stamina}/${user.maxStamina} (${difficulty.stamina}体力/局)`,
      `📚 当前词库: ${difficulty.wordSource}`,
      '/wordle start - 开始游戏',
      '/wordle difficulty - 修改难度'
    ].join('\n'), true)

    return true
  }

  async startWordleGame(e) {
    if (!await this.ensureUsable(e)) {
      return true
    }

    const sessionId = this.getSessionId(e)
    if (!this.ensureNoBoomConflict(e, sessionId, '开启 Wordle', '/boom - 查看数字炸弹房间状态')) {
      return true
    }

    const activeMlGame = getMlGame(sessionId, e.user_id)
    if (activeMlGame) {
      await e.reply([
        '主人现在正在进行密码破译喵~',
        '先把这局 `/ml` 结束掉，再来开启 Wordle 吧~'
      ].join('\n'), true)
      return true
    }

    const active24Game = getActiveGame(sessionId, e.user_id)
    if (active24Game) {
      await e.reply([
        '主人现在正在玩 24 点喵~',
        '先完成当前的 `/24g answer ...`，再来开启 Wordle 吧~'
      ].join('\n'), true)
      return true
    }

    const activeWordleGame = getWordleGame(sessionId, e.user_id)
    if (activeWordleGame) {
      await e.reply([
        '主人已经有一局进行中的 Wordle 啦喵~',
        '继续猜单词，或者等这局结束后再来一局吧~'
      ].join('\n'), true)
      return true
    }

    const user = getUserData(e.user_id)
    const difficulty = WORDLE_DIFFICULTIES[user.wordleDifficulty] || WORDLE_DIFFICULTIES[1]

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

    setWordleGame(sessionId, e.user_id, {
      answer: getRandomWordleWord(user.wordleDifficulty),
      difficulty: user.wordleDifficulty,
      history: [],
      startTime: Date.now()
    })

    await e.reply([
      'Wordle 开始喵~',
      '大喵喵已经藏好了一个 5 字母单词。',
      `当前词库: ${difficulty.wordSource}`,
      '请使用 /wordle <单词> 开始猜测',
      '例如: /wordle apple'
    ].join('\n'), true)

    return true
  }

  async showWordleDifficultyMenu(e) {
    if (!await this.ensureUsable(e)) {
      return true
    }

    const user = getUserData(e.user_id)
    const difficulty = WORDLE_DIFFICULTIES[user.wordleDifficulty] || WORDLE_DIFFICULTIES[1]

    await e.reply([
      `当前难度: ${difficulty.name}`,
      `当前词库: ${difficulty.wordSource}`,
      '',
      '/wordle difficulty 0 - 简单 (高考基础词库, 10体力/局, 8次机会, 无时限)',
      '/wordle difficulty 1 - 普通 (高考基础 + 四级附加, 15体力/局, 6次机会, 180秒)',
      '/wordle difficulty 2 - 困难 (高考基础 + 四级附加 + 六级附加, 20体力/局, 5次机会, 120秒)',
      '/wordle difficulty 3 - 极限 (原版 Wordle 词库, 25体力/局, 4次机会, 60秒)'
    ].join('\n'), true)

    return true
  }

  async setWordleDifficulty(e) {
    if (!await this.ensureUsable(e)) {
      return true
    }

    const match = (e.msg || '').match(/^(?:\/|#)?(?:wordle|wd)\s+difficulty\s+(\d+)\s*$/i)
    const difficultyId = match ? parseInt(match[1]) : NaN

    if (!(difficultyId in WORDLE_DIFFICULTIES)) {
      await e.reply('无效的难度等级\n可选: 0-简单, 1-普通, 2-困难, 3-极限', true)
      return true
    }

    const user = getUserData(e.user_id)
    user.wordleDifficulty = difficultyId
    saveUserData()

    const difficulty = WORDLE_DIFFICULTIES[difficultyId]
    await e.reply([
      `Wordle 难度已设置为: ${difficulty.name}`,
      difficulty.desc,
      `词库: ${difficulty.wordSource}`,
      `消耗体力: ${difficulty.stamina}`
    ].join('\n'), true)
    return true
  }

  async submitWordleAnswer(e) {
    if (!await this.ensureUsable(e)) {
      return true
    }

    const sessionId = this.getSessionId(e)
    const game = getWordleGame(sessionId, e.user_id)
    if (!game) {
      return false
    }

    const difficulty = WORDLE_DIFFICULTIES[game.difficulty] || WORDLE_DIFFICULTIES[1]
    if (isWordleTimeout(game, difficulty)) {
      const { penaltyLine } = this.applyWordleFailurePenalty(e.user_id, difficulty)
      deleteWordleGame(sessionId, e.user_id)
      const { fallbackText, imageText } = await this.buildWordleSettlementReply({
        title: 'Wordle - 失败',
        answer: game.answer,
        history: game.history,
        leadingLines: [
          `时间到啦喵... 正确答案是 ${game.answer.toLowerCase()}`
        ],
        trailingLines: [
          penaltyLine,
          '/wordle start - 再来一次'
        ]
      })
      await this.replyWordleCard(e, {
        history: game.history,
        maxAttempts: difficulty.maxAttempts
      }, fallbackText, imageText)
      return true
    }

    const match = (e.msg || '').match(/^(?:\/|#)?(?:wordle|wd)\s+([a-zA-Z]{5})\s*$/i)
    const guess = normalizeWordleGuess(match?.[1])
    if (!guess || !/^[A-Z]{5}$/.test(guess)) {
      return false
    }

    if (isBlockedSexualWord(guess)) {
      await e.reply('这个词太涩啦喵，换一个正常的 5 字母单词试试看吧~', true)
      return true
    }

    if (!isValidWordleWord(guess)) {
      await e.reply('这个单词不在大喵喵的小词典里喵，换一个 5 字母单词试试看吧~', true)
      return true
    }

    const marks = evaluateWordleGuess(game.answer, guess)
    game.history.push({ guess, marks })

    if (guess === game.answer) {
      const user = getUserData(e.user_id)
      const rewards = calculateWordleRewards(game, difficulty)

      user.coins += rewards.coinReward
      user.favor += rewards.favorReward
      syncUserData(user, { persist: true })

      deleteWordleGame(sessionId, e.user_id)
      const { fallbackText, imageText } = await this.buildWordleSettlementReply({
        title: 'Wordle - 成功',
        answer: game.answer,
        history: game.history,
        trailingLines: [
          `总共试了 ${game.history.length} 次`,
          `游戏机吐出了 ${rewards.coinReward} 枚 Star 币, 同时还获得了来自大喵喵的 ${rewards.favorReward} 点好感度`,
          '/wordle start - 再来一次'
        ]
      })
      await this.replyWordleCard(e, {
        history: game.history,
        maxAttempts: difficulty.maxAttempts
      }, fallbackText, imageText)
      return true
    }

    if (difficulty.maxAttempts && game.history.length >= difficulty.maxAttempts) {
      const { penaltyLine } = this.applyWordleFailurePenalty(e.user_id, difficulty)
      deleteWordleGame(sessionId, e.user_id)
      const { fallbackText, imageText } = await this.buildWordleSettlementReply({
        title: 'Wordle - 失败',
        answer: game.answer,
        history: game.history,
        leadingLines: [
          `次数用完啦... 正确答案是 ${game.answer.toLowerCase()}`
        ],
        trailingLines: [
          penaltyLine,
          '/wordle start - 再来一次'
        ]
      })
      await this.replyWordleCard(e, {
        history: game.history,
        maxAttempts: difficulty.maxAttempts
      }, fallbackText, imageText)
      return true
    }

    const remainSeconds = getWordleRemainingSeconds(game, difficulty)
    const fallbackLines = []
    if (remainSeconds !== null) {
      fallbackLines.push(`剩余时间 ${remainSeconds} 秒`)
    } else {
      fallbackLines.push(`已尝试 ${game.history.length}/${difficulty.maxAttempts} 次`)
    }

    fallbackLines.push(...formatWordleHistory(game.history))
    fallbackLines.push('继续输入 /wordle <单词> 以继续猜测')

    await this.replyWordleCard(e, {
      history: game.history,
      maxAttempts: difficulty.maxAttempts
    }, fallbackLines.join('\n'), remainSeconds !== null
      ? `剩余时间 ${remainSeconds} 秒`
      : `已尝试 ${game.history.length}/${difficulty.maxAttempts} 次`)
    return true
  }

  async showBoomMenu(e) {
    if (!await this.ensureUsable(e)) {
      return true
    }

    if (!await this.ensureBoomGroupOnly(e)) {
      return true
    }

    const sessionId = this.getSessionId(e)
    const room = getBoomRoom(sessionId)

    if (room) {
      await e.reply(this.formatBoomRoomLines(room).join('\n'), true)
      return true
    }

    const user = getUserData(e.user_id)
    const difficulty = BOOM_DIFFICULTIES[user.boomDifficulty] || BOOM_DIFFICULTIES[1]

    await e.reply([
      '来和大家一起玩数字炸弹喵~',
      '至少 2 个人才能开玩，炸到的人会当场 boom！',
      '',
      `当前 Star 币: ${user.coins}`,
      `当前难度: ${difficulty.name} (名义 ${difficulty.stakeLabel} 档, 实际入池 ${difficulty.stakeRange[0]}-${difficulty.stakeRange[1]})`,
      `入场条件: 至少 ${BOOM_MIN_COINS} 枚 Star 币`,
      '/boom create - 创建房间',
      '/boom join - 加入房间',
      '/boom difficulty - 修改难度'
    ].join('\n'), true)
    return true
  }

  async showBoomDifficultyMenu(e) {
    if (!await this.ensureUsable(e)) {
      return true
    }

    if (!await this.ensureBoomGroupOnly(e)) {
      return true
    }

    const user = getUserData(e.user_id)
    const difficulty = BOOM_DIFFICULTIES[user.boomDifficulty] || BOOM_DIFFICULTIES[1]

    await e.reply([
      `当前难度: ${difficulty.name}`,
      '',
      '/boom difficulty 0 - 简单 (名义 10 档, 实际入池 3-6)',
      '/boom difficulty 1 - 普通 (名义 20 档, 实际入池 5-8)',
      '/boom difficulty 2 - 困难 (名义 30 档, 实际入池 7-11)',
      '/boom difficulty 3 - 极限 (名义 40 档, 实际入池 9-14)',
      '',
      '实际扣币会在开局时随机结算，且始终小于 15'
    ].join('\n'), true)
    return true
  }

  async setBoomDifficulty(e) {
    if (!await this.ensureUsable(e)) {
      return true
    }

    if (!await this.ensureBoomGroupOnly(e)) {
      return true
    }

    const match = (e.msg || '').match(/^(?:\/|#)?boom\s+difficulty\s+(\d+)\s*$/i)
    const difficultyId = match ? parseInt(match[1]) : NaN

    if (!(difficultyId in BOOM_DIFFICULTIES)) {
      await e.reply('无效的难度等级\n可选: 0-简单, 1-普通, 2-困难, 3-极限', true)
      return true
    }

    const sessionId = this.getSessionId(e)
    const room = getBoomRoom(sessionId)
    const user = getUserData(e.user_id)
    const difficulty = BOOM_DIFFICULTIES[difficultyId]

    user.boomDifficulty = difficultyId
    saveUserData()

    const lines = [
      `数字炸弹难度已设置为: ${difficulty.name}`,
      `名义档位: ${difficulty.stakeLabel}`,
      `实际入池: ${difficulty.stakeRange[0]}-${difficulty.stakeRange[1]}`
    ]

    if (room && isBoomParticipant(room, e.user_id)) {
      lines.push('当前房间仍按加入时记录的难度结算，下次建房或加入新房间时生效喵~')
    }

    await e.reply(lines.join('\n'), true)
    return true
  }

  async createBoomGameRoom(e) {
    if (!await this.ensureUsable(e)) {
      return true
    }

    if (!await this.ensureBoomGroupOnly(e)) {
      return true
    }

    const sessionId = this.getSessionId(e)
    if (!await this.ensureBoomAvailable(e, sessionId)) {
      return true
    }

    const existsRoom = getBoomRoom(sessionId)
    if (existsRoom) {
      if (isBoomParticipant(existsRoom, e.user_id)) {
        await e.reply('主人已经在这间数字炸弹房里啦喵~ 直接用 /boom 查看房间状态吧~', true)
      } else {
        await e.reply('当前群已经有一间数字炸弹房啦喵~ 先加入或等这局结束吧~', true)
      }
      return true
    }

    const user = getUserData(e.user_id)
    if (user.coins < BOOM_MIN_COINS) {
      await e.reply(`至少要有 ${BOOM_MIN_COINS} 枚 Star 币才能玩数字炸弹喵~`, true)
      return true
    }

    const room = createBoomRoom(sessionId, e.group_id, e.user_id, user.boomDifficulty)
    const roomId = room.roomId
    let roomIdleToken = 0
    const roomIdleTimer = setTimeout(() => {
      void this.handleBoomRoomIdleTimeout(sessionId, roomId, roomIdleToken, e.group_id)
    }, BOOM_ROOM_IDLE_MS)
    roomIdleToken = setBoomRoomIdle(room, roomIdleTimer, BOOM_ROOM_IDLE_MS)
    const difficulty = BOOM_DIFFICULTIES[user.boomDifficulty] || BOOM_DIFFICULTIES[1]

    await e.reply([
      '数字炸弹房间创建成功喵~',
      `房主: ${this.getBoomPlayerLabel(e.user_id)}`,
      `当前人数: ${room.players.length}/${BOOM_MAX_PLAYERS}`,
      `未开始超过 ${Math.floor(BOOM_ROOM_IDLE_MS / 60000)} 分钟会自动取消`,
      `你的难度: ${difficulty.name} (实际入池 ${difficulty.stakeRange[0]}-${difficulty.stakeRange[1]})`,
      `/boom join - 让其他人加入`,
      `/boom start - 开启 15 秒倒计时`
    ].join('\n'), true)
    return true
  }

  async joinBoomGameRoom(e) {
    if (!await this.ensureUsable(e)) {
      return true
    }

    if (!await this.ensureBoomGroupOnly(e)) {
      return true
    }

    const sessionId = this.getSessionId(e)
    const room = getBoomRoom(sessionId)
    if (!room) {
      await e.reply('当前群还没有数字炸弹房喵~ 先用 /boom create 建一个吧~', true)
      return true
    }

    if (!await this.ensureBoomAvailable(e, sessionId)) {
      return true
    }

    if (room.status === 'active') {
      await e.reply('这局数字炸弹已经开始啦喵~ 等下一局再加入吧~', true)
      return true
    }

    if (isBoomParticipant(room, e.user_id)) {
      await e.reply('主人已经在这间数字炸弹房里啦喵~', true)
      return true
    }

    if (room.players.length >= BOOM_MAX_PLAYERS) {
      await e.reply(`房间已经满员啦喵~ 最多只能 ${BOOM_MAX_PLAYERS} 个人一起玩`, true)
      return true
    }

    const user = getUserData(e.user_id)
    if (user.coins < BOOM_MIN_COINS) {
      await e.reply(`至少要有 ${BOOM_MIN_COINS} 枚 Star 币才能加入数字炸弹喵~`, true)
      return true
    }

    addBoomPlayer(room, e.user_id, user.boomDifficulty)
    const difficulty = BOOM_DIFFICULTIES[user.boomDifficulty] || BOOM_DIFFICULTIES[1]
    const lines = [
      `${this.getBoomPlayerLabel(e.user_id)} 加入了数字炸弹房喵~`,
      `当前人数: ${room.players.length}/${BOOM_MAX_PLAYERS}`,
      `当前难度: ${difficulty.name} (实际入池 ${difficulty.stakeRange[0]}-${difficulty.stakeRange[1]})`
    ]

    if (room.status === 'countdown') {
      lines.push(`倒计时还剩 ${this.getBoomCountdownSeconds(room)} 秒，快抓紧上车喵~`)
    } else {
      lines.push('房主可以使用 /boom start 开启 15 秒倒计时')
    }

    await e.reply(lines.join('\n'), true)
    return true
  }

  async leaveBoomGameRoom(e) {
    if (!await this.ensureUsable(e)) {
      return true
    }

    if (!await this.ensureBoomGroupOnly(e)) {
      return true
    }

    const sessionId = this.getSessionId(e)
    const room = getBoomRoom(sessionId)
    if (!room || !isBoomParticipant(room, e.user_id)) {
      await e.reply('主人当前不在数字炸弹房里喵~', true)
      return true
    }

    if (room.status === 'active') {
      await this.finishBoomGame(sessionId, room, e.user_id, {
        reason: 'leave'
      })
      return true
    }

    const { newHostId } = removeBoomPlayer(room, e.user_id)
    const lines = [`${this.getBoomPlayerLabel(e.user_id)} 离开了数字炸弹房喵~`]

    if (!room.players.length) {
      deleteBoomRoom(sessionId)
      lines.push('房间里已经没人啦喵，数字炸弹房已自动关闭~')
      await e.reply(lines.join('\n'), true)
      return true
    }

    lines.push(`当前人数: ${room.players.length}/${BOOM_MAX_PLAYERS}`)

    if (newHostId) {
      lines.push(`新房主: ${this.getBoomPlayerLabel(newHostId)}`)
    }

    if (room.status === 'countdown') {
      lines.push(`当前倒计时还剩 ${this.getBoomCountdownSeconds(room)} 秒`)
    }

    await e.reply(lines.join('\n'), true)
    return true
  }

  async startBoomCountdown(e) {
    if (!await this.ensureUsable(e)) {
      return true
    }

    if (!await this.ensureBoomGroupOnly(e)) {
      return true
    }

    const sessionId = this.getSessionId(e)
    const room = getBoomRoom(sessionId)
    if (!room) {
      await e.reply('当前群还没有数字炸弹房喵~ 先用 /boom create 建一个吧~', true)
      return true
    }

    if (!isBoomParticipant(room, e.user_id)) {
      await e.reply('主人不在这间数字炸弹房里喵，不能帮忙开局哦~', true)
      return true
    }

    if (room.hostId !== String(e.user_id)) {
      await e.reply('只有房主才能开启数字炸弹倒计时喵~', true)
      return true
    }

    if (room.status === 'active') {
      await e.reply('这局数字炸弹已经开始啦喵~', true)
      return true
    }

    if (room.status === 'countdown') {
      await e.reply(`倒计时已经开始啦喵~ 还剩 ${this.getBoomCountdownSeconds(room)} 秒`, true)
      return true
    }

    const roomId = room.roomId
    let countdownToken = 0
    const timer = setTimeout(() => {
      void this.handleBoomCountdownEnd(sessionId, roomId, countdownToken, e.group_id)
    }, BOOM_COUNTDOWN_MS)

    countdownToken = setBoomCountdown(room, timer, BOOM_COUNTDOWN_MS)

    await e.reply([
      '数字炸弹倒计时开始啦喵~',
      `剩余 ${Math.floor(BOOM_COUNTDOWN_MS / 1000)} 秒可继续用 /boom join 加入`,
      `当前人数: ${room.players.length}/${BOOM_MAX_PLAYERS}`,
      '倒计时结束时人数不足 2 会自动取消本房间'
    ].join('\n'), true)
    return true
  }

  async cancelBoomGameRoom(e) {
    if (!await this.ensureUsable(e)) {
      return true
    }

    if (!await this.ensureBoomGroupOnly(e)) {
      return true
    }

    const sessionId = this.getSessionId(e)
    const room = getBoomRoom(sessionId)
    if (!room) {
      await e.reply('当前群还没有数字炸弹房喵~', true)
      return true
    }

    if (room.hostId !== String(e.user_id)) {
      await e.reply('只有房主才能取消数字炸弹房喵~', true)
      return true
    }

    if (room.status === 'active') {
      await e.reply('这局数字炸弹已经开始啦喵，不能直接取消，只能继续猜或用 /boom leave 主动 boom~', true)
      return true
    }

    deleteBoomRoom(sessionId)
    await e.reply('数字炸弹房已取消喵~ 大家下次再玩吧~', true)
    return true
  }

  async submitBoomGuess(e) {
    if (!await this.ensureUsable(e)) {
      return true
    }

    if (!await this.ensureBoomGroupOnly(e)) {
      return true
    }

    const sessionId = this.getSessionId(e)
    const room = getBoomRoom(sessionId)
    if (!room) {
      await e.reply('当前没有数字炸弹房喵~', true)
      return true
    }

    if (!isBoomParticipant(room, e.user_id)) {
      await e.reply('主人没在这局数字炸弹里喵~', true)
      return true
    }

    if (room.status !== 'active') {
      await e.reply('这局数字炸弹还没正式开始喵~ 先等房主 /boom start 吧~', true)
      return true
    }

    const match = (e.msg || '').match(/^(?:\/|#)?boom\s+(\d+)\s*$/i)
    const guess = match ? parseInt(match[1]) : NaN
    const result = applyBoomGuess(room, e.user_id, guess)

    if (!result.ok) {
      if (result.reason === 'not_turn') {
        await e.reply(`现在还没轮到主人喵~ 先等 ${this.getBoomPlayerLabel(result.currentPlayerId)} 出手吧~`, true)
        return true
      }

      if (result.reason === 'out_of_range') {
        await e.reply(`这个数字超出当前可猜范围啦喵~ 现在只能猜 ${result.range.min}-${result.range.max}`, true)
        return true
      }

      await e.reply('这个输入不对喵，记得使用 /boom <数字> 来猜~', true)
      return true
    }

    if (result.result === 'boom') {
      await this.finishBoomGame(sessionId, room, e.user_id, {
        reason: 'guess',
        guess
      })
      return true
    }

    const hintLine = result.direction === 'higher'
      ? '还不够大喵，炸弹在更高一点的位置~'
      : '太大啦喵，炸弹躲在更低一点的位置~'

    await e.reply([
      `${this.getBoomPlayerLabel(e.user_id)} 猜了 ${guess}`,
      hintLine,
      `当前区间: ${result.range.min}-${result.range.max}`,
      `轮到 ${this.getBoomPlayerLabel(result.nextPlayerId)} 了喵~`
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
    if (!this.ensureNoBoomConflict(e, sessionId, '开启新的 24 点', '/boom - 查看数字炸弹房间状态')) {
      return true
    }

    const activeMlGame = getMlGame(sessionId, e.user_id)
    if (activeMlGame) {
      await e.reply([
        '主人现在正在进行密码破译喵~',
        '先把这局 `/ml` 结束掉，再来开启新的 24 点吧~'
      ].join('\n'), true)
      return true
    }

    const activeWordleGame = getWordleGame(sessionId, e.user_id)
    if (activeWordleGame) {
      await e.reply([
        '主人现在正在玩猜单词喵~',
        '先把这局 `/wordle` 结束掉，再来开启新的 24 点吧~'
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
    this.syncSenderNickname(e)

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

  syncSenderNickname(e) {
    const nickname = (e?.sender?.nickname || e?.sender?.card || '').trim()
    if (!e?.user_id || !nickname) {
      return
    }

    updateUserNickname(e.user_id, nickname)
  }

  async ensureBoomGroupOnly(e) {
    if (e.group_id) {
      return true
    }

    await e.reply('数字炸弹至少需要两人，只能在群聊中游玩喵~', true)
    return false
  }

  async ensureBoomAvailable(e, sessionId) {
    const activeMlGame = getMlGame(sessionId, e.user_id)
    if (activeMlGame) {
      await e.reply([
        '主人现在正在进行密码破译喵~',
        '先把这局 `/ml` 结束掉，再来玩数字炸弹吧~'
      ].join('\n'), true)
      return false
    }

    const activeWordleGame = getWordleGame(sessionId, e.user_id)
    if (activeWordleGame) {
      await e.reply([
        '主人现在正在玩猜单词喵~',
        '先把这局 `/wordle` 结束掉，再来玩数字炸弹吧~'
      ].join('\n'), true)
      return false
    }

    const active24Game = getActiveGame(sessionId, e.user_id)
    if (active24Game) {
      await e.reply([
        '主人现在正在玩 24 点喵~',
        '先完成当前的 `/24g answer ...`，再来玩数字炸弹吧~'
      ].join('\n'), true)
      return false
    }

    return true
  }

  ensureNoBoomConflict(e, sessionId, gameLabel, commandText) {
    const room = getBoomRoom(sessionId)
    if (!room || !isBoomParticipant(room, e.user_id)) {
      return true
    }

    const statusText = room.status === 'active'
      ? '正在参加一局数字炸弹'
      : '已经在数字炸弹房里等开局了'

    this.replyWithTimeout(e, [
      `主人${statusText}喵~`,
      `先把这局 \`/boom\` 处理完，再来${gameLabel}吧~`,
      commandText
    ].join('\n'), true)
    return false
  }

  getBoomPlayerLabel(userId) {
    const user = getUserData(userId)
    return `UID ${user.uid}`
  }

  getBoomCountdownSeconds(room) {
    if (!room?.countdownEndsAt) {
      return 0
    }

    return Math.max(0, Math.ceil((room.countdownEndsAt - Date.now()) / 1000))
  }

  getBoomRoomIdleSeconds(room) {
    if (!room?.roomIdleEndsAt || room.status === 'active') {
      return 0
    }

    return Math.max(0, Math.ceil((room.roomIdleEndsAt - Date.now()) / 1000))
  }

  formatBoomPlayerLine(player, index, room) {
    const lineParts = [`${index + 1}. ${this.getBoomPlayerLabel(player.userId)}`]

    if (player.userId === room.hostId) {
      lineParts.push('(房主)')
    }

    lineParts.push(`- ${player.difficultyName}`)

    if (room.status === 'active') {
      lineParts.push(`- 已入池 ${player.actualStake}`)
    }

    if (player.eliminated) {
      lineParts.push('- 已 boom')
    }

    return lineParts.join(' ')
  }

  formatBoomRoomLines(room) {
    const lines = ['数字炸弹房间']
    const statusText = room.status === 'active'
      ? '进行中'
      : room.status === 'countdown'
        ? '倒计时中'
        : '等待中'

    lines.push(`状态: ${statusText}`)
    lines.push(`房主: ${this.getBoomPlayerLabel(room.hostId)}`)
    lines.push(`人数: ${room.players.length}/${BOOM_MAX_PLAYERS}`)

    if (room.status !== 'active') {
      lines.push(`未开始剩余: ${this.getBoomRoomIdleSeconds(room)} 秒`)
    }

    if (room.status === 'countdown') {
      lines.push(`开局倒计时: ${this.getBoomCountdownSeconds(room)} 秒`)
    }

    if (room.status === 'active') {
      const range = getBoomGuessRange(room)
      lines.push(`当前区间: ${range.min}-${range.max}`)
      lines.push(`当前奖池: ${room.prizePool} 枚 Star 币`)
      lines.push(`轮到: ${this.getBoomPlayerLabel(getBoomCurrentPlayerId(room))}`)
    }

    lines.push('', '玩家列表:')
    lines.push(...room.players.map((player, index) => this.formatBoomPlayerLine(player, index, room)))

    if (room.status === 'lobby') {
      lines.push('', '/boom join - 加入房间', '/boom start - 房主开启倒计时')
    } else if (room.status === 'countdown') {
      lines.push('', '/boom join - 趁倒计时继续加入', '/boom leave - 退出当前房间')
    } else {
      lines.push('', '使用 /boom <数字> 继续猜测', '例如: /boom 56')
    }

    return lines
  }

  async sendGroupMessage(groupId, message) {
    if (!groupId) {
      return false
    }

    try {
      const group = botInstance?.pickGroup?.(Number(groupId))
      if (group?.sendMsg) {
        await group.sendMsg(message)
        return true
      }
    } catch (error) {
      logWarn(`[neow][boom-send] 群消息发送失败: ${error?.message || error}`)
    }

    return false
  }

  async handleBoomRoomIdleTimeout(sessionId, roomId, roomIdleToken, groupId) {
    if (!isBoomRoomIdleActive(sessionId, roomId, roomIdleToken)) {
      return
    }

    deleteBoomRoom(sessionId)
    await this.sendGroupMessage(groupId, '数字炸弹房超过 30 分钟还没开始，已自动取消喵~')
  }

  async handleBoomCountdownEnd(sessionId, roomId, countdownToken, groupId) {
    if (!isBoomCountdownActive(sessionId, roomId, countdownToken)) {
      return
    }

    const room = getBoomRoom(sessionId)
    if (!room) {
      return
    }

    const startInfo = prepareBoomStart(room, userId => getUserData(userId).coins)
    const lines = []

    if (startInfo.removedPlayers.length) {
      lines.push(`开局前被移出房间: ${startInfo.removedPlayers.map(player => this.getBoomPlayerLabel(player.userId)).join('、')}`)
      lines.push(`原因: 需要至少 ${BOOM_MIN_COINS} 枚 Star 币才能继续游玩`)
    }

    if (startInfo.hostTransferredTo) {
      lines.push(`房主已转交给 ${this.getBoomPlayerLabel(startInfo.hostTransferredTo)}`)
    }

    if (!startInfo.canStart) {
      deleteBoomRoom(sessionId)
      lines.push('数字炸弹房人数不足 2，已自动取消喵~')
      await this.sendGroupMessage(groupId, lines.join('\n'))
      return
    }

    for (const player of room.players) {
      const user = getUserData(player.userId)
      user.coins = Math.max(0, user.coins - player.actualStake)
      syncUserData(user)
    }
    saveUserData()

    startBoomGame(room)
    const currentPlayerId = getBoomCurrentPlayerId(room)

    lines.push('数字炸弹开始啦喵~')
    lines.push(`本局奖池: ${room.prizePool} 枚 Star 币`)
    lines.push(`出手顺序: ${room.turnOrder.map(userId => this.getBoomPlayerLabel(userId)).join(' -> ')}`)
    lines.push('炸弹已经藏在 1-100 之间了喵，踩中的人会当场 boom！')
    lines.push(`先手: ${this.getBoomPlayerLabel(currentPlayerId)}`)
    lines.push('请使用 /boom <数字> 开始猜测')

    await this.sendGroupMessage(groupId, lines.join('\n'))
  }

  async finishBoomGame(sessionId, room, loserId, options = {}) {
    const result = settleBoomRoom(room, loserId)

    for (const winnerId of result.winnerIds) {
      const user = getUserData(winnerId)
      user.coins += result.payouts[winnerId] || 0
      syncUserData(user)
    }
    saveUserData()

    const lines = ['BOOM!!!']

    if (options.reason === 'leave') {
      lines.push(`${this.getBoomPlayerLabel(loserId)} 主动抱走了炸弹，当场 boom 了喵...`)
    } else {
      lines.push(`${this.getBoomPlayerLabel(loserId)} 猜中了炸弹 ${options.guess}，直接 boom 了喵!`)
    }

    lines.push(`本局奖池: ${room.prizePool} 枚 Star 币`)
    lines.push(`炸弹数字: ${room.bombNumber}`)

    if (!result.winnerIds.length) {
      lines.push('这局没有幸存者喵... 奖池被系统吞掉了')
    } else {
      lines.push('幸存玩家分到的 Star 币:')
      lines.push(...result.winnerIds.map(userId =>
        `  ${this.getBoomPlayerLabel(userId)}: ${result.payouts[userId]}`
      ))
    }

    deleteBoomRoom(sessionId)
    await this.sendGroupMessage(room.groupId, lines.join('\n'))
  }

  extractAnswer(msg) {
    const raw = (msg || '').trim()
    const commandAnswer = raw.replace(/^(?:\/|#)?24g\s+answer\s+/i, '').trim()
    return commandAnswer || raw
  }

  getSessionId(e) {
    return String(e.group_id || e.friend_id || `private:${e.user_id}`)
  }

  applyMlFailurePenalty(userId, difficulty) {
    const user = getUserData(userId)
    const penalty = Math.min(user.coins, calculateMlPenalty(difficulty))

    user.coins = Math.max(0, user.coins - penalty)
    syncUserData(user, { persist: true })

    return {
      penalty,
      penaltyLine: penalty > 0
        ? `大喵喵开心地拿走了主人的 ${penalty} 枚 Star 币`
        : '大喵喵本来想拿走几枚 Star 币, 结果发现主人口袋已经空空的喵...'
    }
  }

  applyWordleFailurePenalty(userId, difficulty) {
    const user = getUserData(userId)
    const penalty = Math.min(user.coins, calculateWordlePenalty(difficulty))

    user.coins = Math.max(0, user.coins - penalty)
    syncUserData(user, { persist: true })

    return {
      penalty,
      penaltyLine: penalty > 0
        ? `大喵喵开心地拿走了主人的 ${penalty} 枚 Star 币`
        : '大喵喵本来想拿走几枚 Star 币, 结果发现主人口袋已经空空的喵...'
    }
  }

  async getWordleMeaningBlock(answer) {
    if (isBlockedSexualWord(answer)) {
      return ''
    }

    const meaning = await fetchWordleMeaning(answer, {
      onError: error => {
        logWarn(`[neow][wordle-dict] 查询 ${String(answer || '').toLowerCase()} 释义失败: ${error?.message || error}`)
      }
    })

    return formatWordleMeaningBlock(meaning)
  }

  async buildWordleSettlementReply({ title, answer, history = [], leadingLines = [], trailingLines = [] }) {
    const historyLines = formatWordleHistory(history)
    const meaningBlock = await this.getWordleMeaningBlock(answer)
    const contentLines = [
      ...leadingLines,
      ...(meaningBlock ? [meaningBlock] : []),
      ...trailingLines
    ]

    return {
      fallbackText: [title, ...historyLines, ...contentLines].join('\n'),
      imageText: contentLines.join('\n')
    }
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

  shouldRenderCard(card, canRender = null) {
    if (typeof canRender === 'function') {
      return Boolean(canRender(card))
    }

    if (typeof canRender === 'boolean') {
      return canRender
    }

    return Array.isArray(card?.history) && card.history.length > 0
  }

  async replyRenderedCard(e, card, fallbackText, imageText = '', renderer, canRender = null) {
    const shouldRenderImage = this.shouldRenderCard(card, canRender)
    const imageBuffer = shouldRenderImage ? await renderer(card) : null

    if (imageBuffer && segmentInstance?.image) {
      try {
        const imagePayload = Buffer.isBuffer(imageBuffer)
          ? `base64://${imageBuffer.toString('base64')}`
          : imageBuffer

        const message = [segmentInstance.image(imagePayload)]
        if (imageText) {
          message.push({
            type: 'text',
            data: {
              text: `\n${imageText}`
            }
          })
        }

        await this.replyWithTimeout(e, message, true)
        return true
      } catch (error) {
        logWarn(`[neow][card-render] 图片发送失败，已降级为文本发送: ${error?.message || error}`)
      }
    }

    if (shouldRenderImage && !imageBuffer) {
      logWarn('[neow][card-render] 图片渲染失败，已降级为文本发送')
    } else if (shouldRenderImage && !segmentInstance?.image) {
      logWarn('[neow][card-render] 当前环境不支持图片消息，已降级为文本发送')
    }

    await this.replyWithTimeout(e, fallbackText, true)
    return true
  }

  async replyMlCard(e, card, fallbackText, imageText = '', difficultyId = null) {
    const user = getUserData(e.user_id)
    const modeInfo = this.getMlReplyModeDetails(user.mlReplyMode, difficultyId ?? user.mlDifficulty)

    if (modeInfo.resolvedMode === 'text') {
      await this.replyWithTimeout(e, fallbackText, true)
      return true
    }

    return this.replyRenderedCard(e, card, fallbackText, imageText, renderMlImage)
  }

  async replyWordleCard(e, card, fallbackText, imageText = '') {
    return this.replyRenderedCard(e, card, fallbackText, imageText, renderWordleImage)
  }

  async replyRankCard(e, card, fallbackText) {
    return this.replyRenderedCard(
      e,
      card,
      fallbackText,
      '',
      renderRankImage,
      currentCard => Array.isArray(currentCard?.entries) && currentCard.entries.length > 0
    )
  }
}
