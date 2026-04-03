import plugin from '../../lib/plugins/plugin.js'
import { getUserData, syncUserData } from './meow_user_info.js'

/**
 * meow 24点插件
 */
export class MeowGame24Plugin extends plugin {
  constructor() {
    super({
      name: 'meow_game_24',
      dsc: 'meow 24点游戏',
      event: 'message.group',
      priority: 5000,
      rule: [
        {
          reg: '^/24g\\s*$',
          fnc: 'showMenu'
        },
        {
          reg: '^/24g\\s+start$',
          fnc: 'startGame'
        },
        {
          reg: '^/24g\\s+difficulty\\s*$',
          fnc: 'showDifficultyMenu'
        },
        {
          reg: '^/24g\\s+difficulty\\s+(\\d+)$',
          fnc: 'setDifficulty'
        },
        {
          reg: '^/24g\\s+answer\\s+(.+)$',
          fnc: 'submitAnswer'
        }
      ]
    })

    this.games = new Map()
    this.difficulties = {
      0: { name: '练习', numCount: 4, stamina: 0, coinRange: [0, 0], favorRange: [0, 0], penalty: 0, needFormula: false },
      1: { name: '普通', numCount: 4, stamina: 10, coinRange: [1, 4], favorRange: [1, 4], penalty: 2, needFormula: false },
      2: { name: '困难', numCount: [3, 4, 5], stamina: 20, coinRange: [1, 7], favorRange: [1, 7], penalty: 3, needFormula: false },
      3: { name: '极限', numCount: [4, 5, 6], stamina: 30, coinRange: [1, 15], favorRange: [1, 15], penalty: 7, needFormula: true }
    }
  }

  /**
   * 获取游戏键
   */
  getGameKey(groupId, userId) {
    return `${groupId}:${userId}`
  }

  /**
   * 显示24点菜单
   */
  async showMenu(e) {
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
      '/24g difficulty - 修改难度',
      '/24g sign - 每日签到'
    ].join('\n'), true)

    return true
  }

  /**
   * 显示难度菜单
   */
  async showDifficultyMenu(e) {
    const user = getUserData(e.user_id)

    await e.reply([
      `当前难度: ${this.difficulties[user.difficulty].name}`,
      '',
      '/24g difficulty 0 - 练习 (0体力/局, 0奖励)',
      '/24g difficulty 1 - 普通 (10体力/局, 1-4 Star币, 1-4 好感度)',
      '/24g difficulty 2 - 困难 (20体力/局, 1-7 Star币, 1-7 好感度)',
      '/24g difficulty 3 - 极限 (30体力/局, 1-15 Star币, 1-15 好感度, 需输入算式)'
    ].join('\n'), true)

    return true
  }

  /**
   * 生成随机数字
   */
  generateNumbers(count) {
    if (Array.isArray(count)) {
      count = count[Math.floor(Math.random() * count.length)]
    }

    const numbers = []
    for (let i = 0; i < count; i++) {
      numbers.push(Math.floor(Math.random() * 13) + 1)
    }

    return numbers
  }

  /**
   * 24点求解器
   */
  solve24(numbers) {
    const solve = (nums, exprs) => {
      if (nums.length === 1) {
        return Math.abs(nums[0] - 24) < 1e-6 ? exprs[0] : null
      }

      for (let i = 0; i < nums.length; i++) {
        for (let j = i + 1; j < nums.length; j++) {
          const a = nums[i]
          const b = nums[j]
          const ea = exprs[i]
          const eb = exprs[j]
          const remaining = nums.filter((_, k) => k !== i && k !== j)
          const remainingExprs = exprs.filter((_, k) => k !== i && k !== j)

          const ops = [
            [a + b, `(${ea}+${eb})`],
            [a - b, `(${ea}-${eb})`],
            [b - a, `(${eb}-${ea})`],
            [a * b, `(${ea}*${eb})`]
          ]

          if (Math.abs(b) > 1e-9) ops.push([a / b, `(${ea}/${eb})`])
          if (Math.abs(a) > 1e-9) ops.push([b / a, `(${eb}/${ea})`])

          for (const [newNum, newExpr] of ops) {
            if (Math.abs(newNum) > 1000) continue

            const result = solve(
              [...remaining, newNum],
              [...remainingExprs, newExpr]
            )

            if (result) return result
          }
        }
      }

      return null
    }

    const nums = numbers.map(n => parseFloat(n))
    const exprs = nums.map(n => n.toString())
    return solve(nums, exprs)
  }

  /**
   * 随机生成奖励
   */
  rollReward(range) {
    const [min, max] = range
    return Math.floor(Math.random() * (max - min + 1)) + min
  }

  /**
   * 计算本局奖励
   */
  calculateRewards(game, config, elapsed) {
    let coinReward = this.rollReward(config.coinRange)
    let favorReward = this.rollReward(config.favorRange)

    if (game.numbers.length > 4 && elapsed < 30) {
      const timeRate = Math.max(0.2, elapsed / 30)
      if (coinReward > 0) {
        coinReward = Math.max(1, Math.floor(coinReward * timeRate))
      }
      if (favorReward > 0) {
        favorReward = Math.max(1, Math.floor(favorReward * timeRate))
      }
    }

    return {
      coinReward,
      favorReward
    }
  }

  /**
   * 开始游戏
   */
  async startGame(e) {
    const user = getUserData(e.user_id)
    const config = this.difficulties[user.difficulty]
    const gameKey = this.getGameKey(e.group_id, e.user_id)

    if (user.stamina < config.stamina) {
      await e.reply([
        '体力不足',
        `当前体力: ${user.stamina}/${user.maxStamina}`,
        `需要体力: ${config.stamina}`,
        '体力恢复速度: 1点/分钟'
      ].join('\n'), true)
      return true
    }

    const numbers = this.generateNumbers(config.numCount)
    const solution = this.solve24(numbers)

    if (config.stamina > 0) {
      user.stamina -= config.stamina
    }

    this.games.set(gameKey, {
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

  /**
   * 设置难度
   */
  async setDifficulty(e) {
    const difficulty = parseInt(e.msg.match(/\d+/)[0])

    if (!(difficulty in this.difficulties)) {
      await e.reply('无效的难度等级\n可选: 0-练习, 1-普通, 2-困难, 3-极限', true)
      return true
    }

    const user = getUserData(e.user_id)
    user.difficulty = difficulty

    const config = this.difficulties[difficulty]
    await e.reply([
      `难度已设置为: ${config.name}`,
      `消耗体力: ${config.stamina}`,
      `奖励范围: ${config.coinRange[0]}-${config.coinRange[1]} Star币 / ${config.favorRange[0]}-${config.favorRange[1]} 好感度`,
      config.needFormula ? '需要回答完整算式' : '只需回答是否可以组成'
    ].join('\n'), true)

    return true
  }

  /**
   * 提交答案
   */
  async submitAnswer(e) {
    const gameKey = this.getGameKey(e.group_id, e.user_id)
    const game = this.games.get(gameKey)

    if (!game) {
      return false
    }

    const answer = e.msg.replace(/^\/24g\s+answer\s+/i, '').trim()
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
    const rewardInfo = this.calculateRewards(game, config, elapsed)

    if (isCorrect) {
      user.coins += rewardInfo.coinReward
      user.favor += rewardInfo.favorReward
      syncUserData(user)

      await e.reply([
        '回答正确喵~',
        `用时 ${elapsed} 秒`,
        `你获得了 ${rewardInfo.coinReward} 枚Star币 和 来自大喵喵的 ${rewardInfo.favorReward} 好感度`
      ].filter(Boolean).join('\n'), true)
    } else {
      const penalty = config.penalty
      user.coins = Math.max(0, user.coins - penalty)

      await e.reply([
        '恭喜主人...答错啦!',
        `大喵喵开心的拿走了主人的 ${penalty} 枚Star币`,
        `正确答案: ${correctAnswer} (可能非唯一解)`
      ].join('\n'), true)
    }

    this.games.delete(gameKey)
    return true
  }
}
