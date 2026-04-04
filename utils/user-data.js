import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const users = new Map()
const dailySignStats = new Map()
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const signPromptPath = path.join(__dirname, '../resources/sign-prompts.json')
const pokeActionPath = path.join(__dirname, '../resources/poke-actions.json')
const dataDirPath = path.join(__dirname, '../data/q3cc-neow-plugin')
const usersPath = path.join(dataDirPath, 'users.json')
const signStatsPath = path.join(dataDirPath, 'sign-stats.json')
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
let pokeActionConfig

const DEFAULT_POKE_ACTIONS = {
  actions: [
    '你戳了一下大喵喵，什么事也没发生..',
    '你又戳了一下大喵喵。\n大喵喵吐了吐舌头，\n又立刻收回去了喵~',
    '大喵喵抖了抖耳朵，假装刚刚什么都没感觉到喵~',
    '你刚伸手过去，大喵喵就轻轻拍开了你的手指喵。'
  ]
}

function createDefaultUser() {
  return {
    coins: 0,
    favor: 0,
    signCount: 0,
    stamina: 150,
    maxStamina: 150,
    difficulty: 1,
    adminUntil: 0,
    suCode: '',
    suCodeExpire: 0,
    banUntil: 0,
    lastRecover: Date.now(),
    lastSign: 0,
    registerTime: new Date().toISOString()
  }
}

function ensureDataDir() {
  if (!fs.existsSync(dataDirPath)) {
    fs.mkdirSync(dataDirPath, { recursive: true })
  }
}

function saveUsers() {
  ensureDataDir()

  const payload = Object.fromEntries(
    [...users.entries()].map(([userId, user]) => [userId, user])
  )

  fs.writeFileSync(usersPath, JSON.stringify(payload, null, 2), 'utf8')
}

function saveSignStats() {
  ensureDataDir()

  const payload = Object.fromEntries(
    [...dailySignStats.entries()].map(([dayKey, stats]) => [dayKey, {
      count: stats.count,
      users: [...stats.users]
    }])
  )

  fs.writeFileSync(signStatsPath, JSON.stringify(payload, null, 2), 'utf8')
}

function loadPersistedData() {
  try {
    if (fs.existsSync(usersPath)) {
      const rawUsers = JSON.parse(fs.readFileSync(usersPath, 'utf8'))
      for (const [userId, user] of Object.entries(rawUsers)) {
        users.set(normalizeUserId(userId), { ...createDefaultUser(), ...user })
      }
    }
  } catch {
    users.clear()
  }

  try {
    if (fs.existsSync(signStatsPath)) {
      const rawStats = JSON.parse(fs.readFileSync(signStatsPath, 'utf8'))
      for (const [dayKey, stats] of Object.entries(rawStats)) {
        dailySignStats.set(Number(dayKey), {
          count: Number(stats?.count) || 0,
          users: new Set(
            Array.isArray(stats?.users)
              ? stats.users.map(userId => normalizeUserId(userId))
              : []
          )
        })
      }
    }
  } catch {
    dailySignStats.clear()
  }
}

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

function normalizeUserId(userId) {
  return String(userId)
}

function getFavorTier(favor) {
  return FAVOR_LEVELS.find(level => favor >= level.minFavor)
}

function cleanupAdminState(user) {
  let changed = false
  const now = Date.now()

  if ((user.adminUntil || 0) <= now && user.adminUntil) {
    user.adminUntil = 0
    changed = true
  }

  if ((user.suCodeExpire || 0) <= now && (user.suCode || user.suCodeExpire)) {
    user.suCode = ''
    user.suCodeExpire = 0
    changed = true
  }

  return changed
}

function cleanupBanState(user) {
  if ((user.banUntil || 0) > 0 && user.banUntil <= Date.now()) {
    user.banUntil = 0
    return true
  }

  return false
}

loadPersistedData()

export function saveUserData() {
  saveUsers()
}

export function syncUserData(user, options = {}) {
  const beforeFavor = user.favor
  const beforeMaxStamina = user.maxStamina
  const beforeStamina = user.stamina
  const beforeAdminUntil = user.adminUntil || 0
  const beforeSuCode = user.suCode || ''
  const beforeSuCodeExpire = user.suCodeExpire || 0
  const beforeBanUntil = user.banUntil || 0

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

  cleanupAdminState(user)
  cleanupBanState(user)

  const changed = beforeFavor !== user.favor ||
    beforeMaxStamina !== user.maxStamina ||
    beforeStamina !== user.stamina ||
    beforeAdminUntil !== (user.adminUntil || 0) ||
    beforeSuCode !== (user.suCode || '') ||
    beforeSuCodeExpire !== (user.suCodeExpire || 0) ||
    beforeBanUntil !== (user.banUntil || 0)

  if (options.persist && changed) {
    saveUsers()
  }

  return user
}

export function getUserData(userId) {
  const normalizedUserId = normalizeUserId(userId)
  let created = false

  if (!users.has(normalizedUserId)) {
    users.set(normalizedUserId, createDefaultUser())
    created = true
  }

  const user = users.get(normalizedUserId)
  const now = Date.now()

  syncUserData(user, { persist: true })

  if (created) {
    saveUsers()
  }

  if (user.stamina >= user.maxStamina) {
    user.lastRecover = now
    return user
  }

  const elapsed = Math.floor((now - user.lastRecover) / 60000)
  if (elapsed > 0) {
    user.stamina = Math.min(user.maxStamina, user.stamina + elapsed)
    user.lastRecover = now
    saveUsers()
  }

  return user
}

export function generateSuCode(length = 16) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
  const zh = ['喵', '星', '月', '梦', '云', '糖', '铃', '夏', '夜', '雪', '花', '光']
  let code = ''

  for (let i = 0; i < length; i++) {
    if (i % 4 === 0) {
      code += zh[Math.floor(Math.random() * zh.length)]
    } else {
      code += chars[Math.floor(Math.random() * chars.length)]
    }
  }

  return code
}

export function issueSuCode(user, ttlMs = 300000) {
  const code = generateSuCode()
  user.suCode = code
  user.suCodeExpire = Date.now() + ttlMs
  saveUsers()
  return code
}

export function verifySuCode(user, code) {
  syncUserData(user, { persist: true })
  return Boolean(user.suCode) &&
    user.suCode === code &&
    (user.suCodeExpire || 0) > Date.now()
}

export function grantTemporaryAdmin(user, durationMs = 180000) {
  user.adminUntil = Date.now() + durationMs
  user.suCode = ''
  user.suCodeExpire = 0
  saveUsers()
  return user.adminUntil
}

export function clearTemporaryAdmin(user) {
  user.adminUntil = 0
  user.suCode = ''
  user.suCodeExpire = 0
  saveUsers()
}

export function isTemporaryAdmin(user) {
  syncUserData(user, { persist: true })
  return (user.adminUntil || 0) > Date.now()
}

export function getAdminRemainingMs(user) {
  syncUserData(user, { persist: true })
  return Math.max(0, (user.adminUntil || 0) - Date.now())
}

export function banUser(user) {
  user.banUntil = -1
  clearTemporaryAdmin(user)
  saveUsers()
}

export function tempBanUser(user, durationMs) {
  user.banUntil = Date.now() + durationMs
  clearTemporaryAdmin(user)
  saveUsers()
  return user.banUntil
}

export function unbanUser(user) {
  user.banUntil = 0
  saveUsers()
}

export function isBannedUser(user) {
  syncUserData(user, { persist: true })
  return (user.banUntil || 0) === -1 || (user.banUntil || 0) > Date.now()
}

export function getBanRemainingMs(user) {
  syncUserData(user, { persist: true })

  if ((user.banUntil || 0) === -1) {
    return -1
  }

  return Math.max(0, (user.banUntil || 0) - Date.now())
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

export function buildHelpLines(options = {}) {
  const lines = [
    'meow 总菜单',
    '',
    '基础指令:',
    '/nhelp - 获取指令帮助',
    '/ping - 在线状态检查',
    '/poke /戳 - 戳大喵喵',
    '/my - 获取自己的账号信息',
    '/su - 提升自身权限为管理员',
    '/demote - 撤销自身临时管理员身份',
    '/transfer - 转赠 Star 币',
    '/sign - 每日签到',
    '/24g - 二十四点'
  ]

  if (options.isAdmin) {
    const remainText = options.adminRemainingMs
      ? ` (${Math.ceil(options.adminRemainingMs / 1000)} 秒后失效)`
      : ''

    lines.push(
      '',
      `管理员指令:${remainText}`,
      '/setcoin <QQ> <数量> - 设置用户 Star 币数量',
      '/give <QQ> <数量> - 给予用户 Star 币',
      '/rmcoin <QQ> <数量> - 删除用户 Star 币',
      '/ban <QQ> - 永久封禁用户',
      '/tempban <QQ> <分钟> - 临时封禁用户',
      '/unban <QQ> - 解除封禁用户'
    )
  }

  return lines
}

export function recordDailySign(userId, timestamp = Date.now()) {
  const normalizedUserId = normalizeUserId(userId)
  const dayKey = new Date(timestamp).setHours(0, 0, 0, 0)
  const stats = dailySignStats.get(dayKey) || {
    count: 0,
    users: new Set()
  }

  if (!stats.users.has(normalizedUserId)) {
    stats.users.add(normalizedUserId)
    stats.count += 1
    dailySignStats.set(dayKey, stats)
    saveSignStats()
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

export function getRandomPokeAction() {
  if (!pokeActionConfig) {
    try {
      pokeActionConfig = JSON.parse(fs.readFileSync(pokeActionPath, 'utf8'))
    } catch {
      pokeActionConfig = DEFAULT_POKE_ACTIONS
    }
  }

  const actions = Array.isArray(pokeActionConfig.actions) && pokeActionConfig.actions.length
    ? pokeActionConfig.actions
    : DEFAULT_POKE_ACTIONS.actions

  return actions[Math.floor(Math.random() * actions.length)]
}
