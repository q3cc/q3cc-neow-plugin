import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const users = new Map()
const dailySignStats = new Map()
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const signPromptPath = path.join(__dirname, '../resources/sign-prompts.json')
const DEFAULT_SIGN_PROMPTS = {
  prompts: [
    '很勤快哦~ 大喵喵一早就把奖励给你准备好啦~',
    '来得真早呀~ 今天也让大喵喵摸摸头喵~',
    '今天也没鸽掉喵~ 这份认真要记进小本本里~',
    '大喵喵已经等你啦~ 过来领取今日份的小惊喜喵~',
    '脚步声一听就知道是你喵~ 今天也准时得很可爱~',
    '一见到你就开心喵~ 连尾巴都忍不住晃起来啦~',
    '今天也记得来打卡呀~ 真是让大喵喵省心的孩子喵~',
    '哼哼，又被我逮到签到啦~ 这次可不许偷偷溜走喵~',
    '主人今天也很准时喵~ 奖励已经在爪心里捧好啦~',
    '这份认真值得夸夸喵~ 大喵喵可都看在眼里啦~'
  ],
}

let signPromptConfig

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

export function getUserData(userId) {
  if (!users.has(userId)) {
    users.set(userId, {
      coins: 0,
      favor: 0,
      signCount: 0,
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

export function getFavorInfo(favor) {
  const tier = getFavorTier(favor)

  return {
    level: tier.level,
    desc: tier.desc,
    nextLevel: tier.nextLevel,
    needFavor: tier.nextFavor ? tier.nextFavor - favor : 0
  }
}

export function buildUserInfoLines(user, options = {}) {
  const favorInfo = getFavorInfo(user.favor)
  const lines = [
    `Star 币: ${user.coins}`,
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

export function buildHelpLines() {
  return [
    'meow 总菜单',
    '',
    '基础指令:',
    '/nhelp - 获取指令帮助',
    '/ping - 在线状态检查',
    '/my - 获取自己的账号信息',
    '/sign - 每日签到',
    '/24g - 二十四点'
  ]
}

export function recordDailySign(userId, timestamp = Date.now()) {
  const dayKey = new Date(timestamp).setHours(0, 0, 0, 0)
  const stats = dailySignStats.get(dayKey) || {
    count: 0,
    users: new Set()
  }

  if (!stats.users.has(userId)) {
    stats.users.add(userId)
    stats.count += 1
    dailySignStats.set(dayKey, stats)
  }

  return stats.count
}

export function getRandomSignPrompt() {
  if (!signPromptConfig) {
    try {
      signPromptConfig = JSON.parse(fs.readFileSync(signPromptPath, 'utf8'))
    } catch {
      signPromptConfig = DEFAULT_SIGN_PROMPTS
    }
  }

  const prompts = Array.isArray(signPromptConfig.prompts) && signPromptConfig.prompts.length
    ? signPromptConfig.prompts
    : DEFAULT_SIGN_PROMPTS.prompts

  return prompts[Math.floor(Math.random() * prompts.length)]
}
