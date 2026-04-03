import plugin from '../../lib/plugins/plugin.js'

const users = new Map()
const FAVOR_LEVELS = [
  {
    minFavor: 10000,
    level: '生命中最重要的伙伴！',
    desc: '主人已经是大喵喵最最重要的伙伴了喵，这份心意会一直留在尾巴尖上摇呀摇~',
    nextLevel: null,
    nextFavor: null,
    maxStamina: 500
  },
  {
    minFavor: 5000,
    level: '如果你是深渊，我愿坠入其中',
    desc: '就算前面是深渊，大喵喵也会陪着主人一起跳下去喵，绝对不会松开爪爪~',
    nextLevel: '生命中最重要的伙伴！',
    nextFavor: 10000,
    maxStamina: 350
  },
  {
    minFavor: 1000,
    level: '朋友之上, 恋人可及',
    desc: '大喵喵一见到主人就会忍不住靠过去蹭蹭喵，再近一点点也没关系吧~',
    nextLevel: '如果你是深渊，我愿坠入其中',
    nextFavor: 5000,
    maxStamina: 230
  },
  {
    minFavor: 200,
    level: '普通朋友',
    desc: '主人已经是大喵喵的普通朋友啦喵，有空就要来陪我玩，不许偷偷溜走哦~',
    nextLevel: '朋友之上, 恋人可及',
    nextFavor: 1000,
    maxStamina: 180
  },
  {
    minFavor: 100,
    level: '如堕潜梦',
    desc: '和主人说话的时候，大喵喵总有种坠进温柔梦里的感觉喵，心口都软绵绵的~',
    nextLevel: '普通朋友',
    nextFavor: 200,
    maxStamina: 150
  },
  {
    minFavor: 30,
    level: '初见相识',
    desc: '大喵喵已经记住主人的气味啦喵，下次再来时可不许装作不认识我哦~',
    nextLevel: '如堕潜梦',
    nextFavor: 100,
    maxStamina: 150
  },
  {
    minFavor: 0,
    level: '陌生旅客',
    desc: '大喵喵还在悄悄打量主人喵，多陪陪我一点，再让我靠近你一点点嘛~',
    nextLevel: '初见相识',
    nextFavor: 30,
    maxStamina: 150
  }
]

export const difficultyNames = {
  0: '练习',
  1: '普通',
  2: '困难',
  3: '极限'
}

function getFavorTier(favor) {
  return FAVOR_LEVELS.find(level => favor >= level.minFavor)
}

export function syncUserData(user) {
  if (user.favor >= 10000) {
    user.favor = 114514
  }

  const tier = getFavorTier(user.favor)
  user.maxStamina = tier.maxStamina

  if (typeof user.stamina !== 'number') {
    user.stamina = user.maxStamina
  }

  if (user.stamina > user.maxStamina) {
    user.stamina = user.maxStamina
  }

  return user
}

/**
 * 获取用户数据
 */
export function getUserData(userId) {
  if (!users.has(userId)) {
    users.set(userId, {
      coins: 0,
      favor: 0,
      stamina: 150,
      maxStamina: 150,
      difficulty: 1,
      lastRecover: Date.now(),
      lastSign: 0,
      registerTime: new Date().toISOString()
    })
  }

  const user = users.get(userId)
  const now = Date.now()

  syncUserData(user)

  if (user.stamina >= user.maxStamina) {
    user.lastRecover = now
    return user
  }

  const elapsed = Math.floor((now - user.lastRecover) / 60000)
  if (elapsed > 0) {
    user.stamina = Math.min(user.maxStamina, user.stamina + elapsed)
    user.lastRecover = now
  }

  return user
}

/**
 * 获取好感度等级和描述
 */
export function getFavorInfo(favor) {
  const tier = getFavorTier(favor)

  return {
    level: tier.level,
    desc: tier.desc,
    nextLevel: tier.nextLevel,
    needFavor: tier.nextFavor ? tier.nextFavor - favor : 0
  }
}

/**
 * 构建个人信息展示内容
 */
export function buildUserInfoLines(user, options = {}) {
  const favorInfo = getFavorInfo(user.favor)
  const lines = [
    `Star币: ${user.coins}`,
    `好感度: ${user.favor} (${favorInfo.level})`,
    `  ${favorInfo.desc}`,
    favorInfo.nextLevel ? `  距离升级到 ${favorInfo.nextLevel} 还需 ${favorInfo.needFavor} 好感度` : '',
    `体力: ${user.stamina}/${user.maxStamina} (恢复速度: 1/分钟)`
  ]

  if (options.difficultyName) {
    lines.push('', `当前难度: ${options.difficultyName}`)
  }

  if (options.includeRegisterTime && user.registerTime) {
    lines.push(`注册时间: ${new Date(user.registerTime).toLocaleString('zh-CN')}`)
  }

  return lines.filter(Boolean)
}

function buildHelpLines() {
  return [
    'meow 总菜单',
    '',
    '基础指令:',
    '/nhelp - 获取指令帮助',
    '/ping - 在线状态检查',
    '/my - 获取自己的账号信息',
    '/24g - 查看二十四点子命令菜单'
  ]
}

/**
 * meow 用户信息插件
 */
export class MeowUserInfoPlugin extends plugin {
  constructor() {
    super({
      name: 'meow_user_info',
      dsc: 'meow 用户信息与帮助',
      event: 'message',
      priority: 5000,
      rule: [
        {
          reg: '^/(?:neowhelp|nhelp)\\s*$',
          fnc: 'showHelp'
        },
        {
          reg: '^/ping$',
          fnc: 'ping'
        },
        {
          reg: '^/my$',
          fnc: 'myInfo'
        },
        {
          reg: '^/24g\\s+sign$',
          fnc: 'dailySign'
        }
      ]
    })
  }

  async showHelp(e) {
    await e.reply(buildHelpLines().join('\n'), true)
    return true
  }

  async ping(e) {
    await e.reply('大喵喵在线，可以正常使用喵~', true)
    return true
  }

  async myInfo(e) {
    return this.userInfo(e)
  }

  async dailySign(e) {
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

    const coinReward = Math.floor(Math.random() * 100) + 50
    const favorReward = Math.floor(Math.random() * 50) + 20

    user.coins += coinReward
    user.favor += favorReward
    user.lastSign = now
    syncUserData(user)

    await e.reply([
      '签到成功喵~',
      '',
      `获得 ${coinReward} Star币`,
      `获得 ${favorReward} 好感度`,
      '',
      '当前状态:',
      ...buildUserInfoLines(user)
    ].join('\n'), true)

    return true
  }

  async userInfo(e) {
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
}
