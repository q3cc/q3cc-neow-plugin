import fs from 'fs'
import fsp from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import {
  pluginDataDirPath,
  recoverSharedStateTransaction,
  sharedStateTransactionPath,
  writeTextFileAtomically
} from './persistence.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const dataDirPath = pluginDataDirPath
const defaultFarmDataPath = path.join(dataDirPath, 'farm-state.json')
const defaultFarmAddonDirPath = path.join(dataDirPath, 'addons/farm')
const defaultCoreAddonPath = path.join(__dirname, '../resources/farm-core-addon.json')

export const FARM_SCHEMA_VERSION = 2
export const FARM_SUPPORTED_SCHEMA_VERSIONS = [1, 2]
export const FARM_PLOT_COUNT = 15
export const FARM_ORDER_SLOT_COUNT = 5
export const FARM_ORDER_REFRESH_MS = 6 * 60 * 60 * 1000
export const FARM_ADDON_WATCH_DEBOUNCE_MS = 500
export const FARM_DAILY_STEAL_LIMIT = 5
export const FARM_PET_GUARD_CAP_MS = 48 * 60 * 60 * 1000
export const FARM_STEAL_UNLOCK_LEVEL = 20
export const FARM_DAILY_TASK_SLOT_COUNT = 3
export const FARM_PET_LEVEL_THRESHOLDS = [0, 10, 25, 45, 70]

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS
const FARM_ALIAS_PATTERN = /^[a-z0-9_-]+$/
const FARM_NOTIFICATION_LIMIT = 20
const FARM_PET_MAX_LEVEL = FARM_PET_LEVEL_THRESHOLDS.length
const FARM_PET_DEFAULT_GUARD_BASE_HOURS = 4
const FARM_PET_DEFAULT_GUARD_BONUS_PERCENT = 0
const FARM_PET_DEFAULT_FATIGUE_GAIN_PER_HOUR = 8
const FARM_PET_DEFAULT_FOOD_TIER = 1
const FARM_PET_FATIGUE_RECOVERY_PER_HOUR = 12
const FARM_PET_MIN_INTERCEPT_PERCENT = 5
const FARM_PET_MAX_INTERCEPT_PERCENT = 95
const FARM_DAILY_TASK_TEMPLATES = [
  { id: 'open-farm', type: 'open_farm', title: '打开一次 /farm', targetMin: 1, targetMax: 1, coinReward: 20, xpReward: 5, weight: 12 },
  { id: 'buy-seed', type: 'buy_seed', title: '购买种子', targetMin: 2, targetMax: 4, coinReward: 30, xpReward: 8, weight: 10 },
  { id: 'plant', type: 'plant', title: '播种作物', targetMin: 3, targetMax: 5, coinReward: 35, xpReward: 10, weight: 10 },
  { id: 'water', type: 'water', title: '给作物浇水', targetMin: 3, targetMax: 5, coinReward: 35, xpReward: 10, weight: 10 },
  { id: 'harvest', type: 'harvest', title: '收获作物', targetMin: 4, targetMax: 8, coinReward: 45, xpReward: 12, weight: 9 },
  { id: 'sell-crops', type: 'sell_crop_units', title: '卖出作物', targetMin: 4, targetMax: 8, coinReward: 50, xpReward: 15, weight: 8 },
  { id: 'deliver-order', type: 'deliver_order', title: '完成订单', targetMin: 1, targetMax: 2, coinReward: 70, xpReward: 20, weight: 5 }
]
const FARM_QUEST_STEP_TYPES = new Set([
  'open_farm',
  'buy_seed',
  'plant',
  'water',
  'harvest',
  'sell_crop_units',
  'deliver_order',
  'reach_level',
  'buy_plot',
  'harvest_on_land',
  'collect_crop_kinds',
  'buy_pet',
  'buy_pet_food',
  'feed_pet_hours',
  'visit_farm',
  'attempt_steal',
  'successful_steal',
  'accumulate_guard_hours'
])
const LAND_TYPE_LABELS = {
  normal: '普通地',
  yellow: '黄土地',
  black: '黑土地'
}
const LAND_CONFIG = [
  { plotId: 1, landType: 'normal', name: '普通土地', unlockLevel: 1, price: 0, defaultOwned: true, yieldMultiplier: 1, growMultiplier: 1 },
  { plotId: 2, landType: 'normal', name: '普通土地', unlockLevel: 1, price: 0, defaultOwned: true, yieldMultiplier: 1, growMultiplier: 1 },
  { plotId: 3, landType: 'normal', name: '普通土地', unlockLevel: 1, price: 0, defaultOwned: true, yieldMultiplier: 1, growMultiplier: 1 },
  { plotId: 4, landType: 'normal', name: '普通土地', unlockLevel: 1, price: 0, defaultOwned: true, yieldMultiplier: 1, growMultiplier: 1 },
  { plotId: 5, landType: 'normal', name: '普通土地', unlockLevel: 1, price: 0, defaultOwned: true, yieldMultiplier: 1, growMultiplier: 1 },
  { plotId: 6, landType: 'yellow', name: '黄土地', unlockLevel: 20, price: 600, defaultOwned: false, yieldMultiplier: 1.5, growMultiplier: 1 },
  { plotId: 7, landType: 'yellow', name: '黄土地', unlockLevel: 23, price: 800, defaultOwned: false, yieldMultiplier: 1.5, growMultiplier: 1 },
  { plotId: 8, landType: 'yellow', name: '黄土地', unlockLevel: 26, price: 1000, defaultOwned: false, yieldMultiplier: 1.5, growMultiplier: 1 },
  { plotId: 9, landType: 'yellow', name: '黄土地', unlockLevel: 29, price: 1200, defaultOwned: false, yieldMultiplier: 1.5, growMultiplier: 1 },
  { plotId: 10, landType: 'yellow', name: '黄土地', unlockLevel: 32, price: 1500, defaultOwned: false, yieldMultiplier: 1.5, growMultiplier: 1 },
  { plotId: 11, landType: 'black', name: '黑土地', unlockLevel: 36, price: 2000, defaultOwned: false, yieldMultiplier: 2, growMultiplier: 0.85 },
  { plotId: 12, landType: 'black', name: '黑土地', unlockLevel: 40, price: 2600, defaultOwned: false, yieldMultiplier: 2, growMultiplier: 0.85 },
  { plotId: 13, landType: 'black', name: '黑土地', unlockLevel: 44, price: 3300, defaultOwned: false, yieldMultiplier: 2, growMultiplier: 0.85 },
  { plotId: 14, landType: 'black', name: '黑土地', unlockLevel: 47, price: 4100, defaultOwned: false, yieldMultiplier: 2, growMultiplier: 0.85 },
  { plotId: 15, landType: 'black', name: '黑土地', unlockLevel: 50, price: 5000, defaultOwned: false, yieldMultiplier: 2, growMultiplier: 0.85 }
]

let farmConfig = createFarmConfig()
let farmInitialized = false
let farmInitializing = false
let farmRegistry = createEmptyFarmRegistry()
let farmAddonStatus = createEmptyFarmAddonStatus()
let farmStates = new Map()
let farmWatcher = null
let farmWatchTimer = null
let farmDataDirty = false
let farmDataWriting = false
let farmDataFlushPromise = Promise.resolve()
let farmStateLoadError = ''

function createFarmConfig(overrides = {}) {
  return {
    farmDataPath: overrides.farmDataPath || defaultFarmDataPath,
    addonDirPath: overrides.addonDirPath || defaultFarmAddonDirPath,
    coreAddonPath: overrides.coreAddonPath || defaultCoreAddonPath,
    watchEnabled: overrides.watchEnabled !== false,
    watchDebounceMs: Number.isInteger(overrides.watchDebounceMs) && overrides.watchDebounceMs >= 0
      ? overrides.watchDebounceMs
      : FARM_ADDON_WATCH_DEBOUNCE_MS,
    random: typeof overrides.random === 'function' ? overrides.random : Math.random
  }
}

function createEmptyFarmRegistry() {
  return {
    schemaVersion: FARM_SCHEMA_VERSION,
    loadedAt: 0,
    addons: [],
    crops: {},
    cropList: [],
    starterGrants: [],
    orderTemplates: [],
    pets: {},
    petList: [],
    petFoods: {},
    petFoodList: [],
    mainQuestChapters: {},
    mainQuestChapterList: []
  }
}

function createEmptyFarmAddonStatus() {
  return {
    addonDirPath: farmConfig.addonDirPath,
    coreAddonPath: farmConfig.coreAddonPath,
    watching: false,
    lastReloadAt: 0,
    lastSuccessfulReloadAt: 0,
    lastReloadError: '',
    lastReloadReason: '',
    reloadCount: 0,
    loadedAddons: [],
    skippedAddons: []
  }
}

function createDefaultFarmStats() {
  return {
    openFarmCount: 0,
    buySeedCount: 0,
    plantCount: 0,
    waterCount: 0,
    harvestUnits: 0,
    sellCropUnits: 0,
    deliverOrderCount: 0,
    buyPlotCount: 0,
    boughtPlotIds: [],
    harvestOnLand: {
      normal: 0,
      yellow: 0,
      black: 0
    },
    collectedCropAliases: [],
    buyPetCount: 0,
    buyPetFoodCount: 0,
    feedPetAddedMs: 0,
    visitFarmCount: 0,
    attemptStealCount: 0,
    successfulStealCount: 0,
    stolenUnits: 0,
    guardAccumulatedMs: 0
  }
}

function createDefaultDailyFarmStats() {
  return {
    openFarmCount: 0,
    buySeedCount: 0,
    plantCount: 0,
    waterCount: 0,
    harvestUnits: 0,
    sellCropUnits: 0,
    deliverOrderCount: 0
  }
}

function getLandConfig(plotId) {
  return LAND_CONFIG[Number(plotId) - 1] || null
}

function createEmptyPlot(plotId) {
  const land = getLandConfig(plotId)

  return {
    plotId,
    landType: land?.landType || 'normal',
    owned: Boolean(land?.defaultOwned),
    cropAlias: '',
    nameSnapshot: '',
    sellPriceSnapshot: 0,
    yieldTotalSnapshot: 0,
    yieldStolen: 0,
    growMinutesSnapshot: 0,
    waterStaminaSnapshot: 0,
    waterBaseReductionPercentSnapshot: 0,
    plantedAt: 0,
    readyAt: 0,
    watered: false
  }
}

function createDefaultFarmState() {
  return {
    stateVersion: 2,
    createdAt: new Date().toISOString(),
    updatedAt: Date.now(),
    starterGrantApplied: false,
    farmLevel: 1,
    farmXp: 0,
    plots: Array.from({ length: FARM_PLOT_COUNT }, (_, index) => createEmptyPlot(index + 1)),
    seeds: {},
    crops: {},
    pets: {},
    petFoods: {},
    activePetAlias: '',
    guardTrackedAt: 0,
    stats: createDefaultFarmStats(),
    mainQuests: {},
    notifications: [],
    orders: [],
    orderBoardExpiresAt: 0,
    dailyTaskDayKey: 0,
    dailyStats: createDefaultDailyFarmStats(),
    dailyTasks: [],
    lastVisitedFarmUid: 0,
    lastVisitedFarmAt: 0,
    dailyStealDayKey: 0,
    dailyStealAttempts: 0
  }
}

function cloneData(value) {
  return JSON.parse(JSON.stringify(value))
}

function normalizeUserId(userId) {
  return String(userId)
}

function normalizeAlias(alias) {
  return String(alias || '').trim().toLowerCase()
}

function normalizeCount(count) {
  const parsed = Number(count)
  return Number.isInteger(parsed) ? parsed : NaN
}

function isPositiveInteger(value) {
  return Number.isInteger(value) && value > 0
}

function isNonNegativeInteger(value) {
  return Number.isInteger(value) && value >= 0
}

function isPositiveNumber(value) {
  return Number.isFinite(value) && value > 0
}

function normalizeInteger(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isInteger(parsed) ? parsed : fallback
}

function normalizePositiveNumber(value, fallback = 0) {
  const parsed = Number(value)
  return parsed > 0 && Number.isFinite(parsed) ? parsed : fallback
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function getSeedSellPrice(seedPrice) {
  return Math.max(1, Math.floor(Math.max(0, normalizeInteger(seedPrice, 0)) * 0.5))
}

function getFarmDayKey(now = Date.now()) {
  return new Date(now).setHours(0, 0, 0, 0)
}

function nextRandom() {
  return farmConfig.random()
}

function rollInt(min, max) {
  if (min >= max) {
    return min
  }

  return Math.floor(nextRandom() * (max - min + 1)) + min
}

function rollWeighted(items) {
  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0)
  if (totalWeight <= 0) {
    return null
  }

  let cursor = nextRandom() * totalWeight
  for (const item of items) {
    cursor -= item.weight
    if (cursor < 0) {
      return item
    }
  }

  return items[items.length - 1] || null
}

function xpToNext(level) {
  return 20 + (Number(level) * 5)
}

function getLevelStartXp(level) {
  const normalizedLevel = Math.max(1, normalizeInteger(level, 1))
  let total = 0

  for (let current = 1; current < normalizedLevel; current++) {
    total += xpToNext(current)
  }

  return total
}

function resolveFarmLevelFromXp(totalXp) {
  let xp = Math.max(0, normalizeInteger(totalXp, 0))
  let level = 1

  while (xp >= xpToNext(level)) {
    xp -= xpToNext(level)
    level += 1
  }

  return level
}

function getFarmLevelProgressInfo(totalXp) {
  let xp = Math.max(0, normalizeInteger(totalXp, 0))
  let level = 1

  while (xp >= xpToNext(level)) {
    xp -= xpToNext(level)
    level += 1
  }

  return {
    level,
    currentXp: xp,
    neededXp: xpToNext(level),
    totalXp: Math.max(0, normalizeInteger(totalXp, 0))
  }
}

function getPetMaxXp() {
  return FARM_PET_LEVEL_THRESHOLDS[FARM_PET_LEVEL_THRESHOLDS.length - 1] || 0
}

function getPetLevelStartXp(level) {
  const index = clamp(normalizeInteger(level, 1), 1, FARM_PET_MAX_LEVEL) - 1
  return FARM_PET_LEVEL_THRESHOLDS[index] || 0
}

function resolvePetLevelFromXp(totalXp) {
  const xp = clamp(normalizeInteger(totalXp, 0), 0, getPetMaxXp())
  let level = 1
  for (let index = 0; index < FARM_PET_LEVEL_THRESHOLDS.length; index++) {
    if (xp >= FARM_PET_LEVEL_THRESHOLDS[index]) {
      level = index + 1
    }
  }
  return level
}

function getPetLevelProgressInfo(totalXp) {
  const cappedXp = clamp(normalizeInteger(totalXp, 0), 0, getPetMaxXp())
  const level = resolvePetLevelFromXp(cappedXp)
  const levelStartXp = getPetLevelStartXp(level)
  const nextLevel = Math.min(FARM_PET_MAX_LEVEL, level + 1)
  const nextLevelStartXp = level >= FARM_PET_MAX_LEVEL
    ? getPetMaxXp()
    : getPetLevelStartXp(nextLevel)

  return {
    level,
    totalXp: cappedXp,
    currentXp: level >= FARM_PET_MAX_LEVEL ? cappedXp : cappedXp - levelStartXp,
    neededXp: level >= FARM_PET_MAX_LEVEL ? 0 : Math.max(0, nextLevelStartXp - levelStartXp),
    nextLevel,
    isMaxLevel: level >= FARM_PET_MAX_LEVEL
  }
}

function syncPetLevel(entry) {
  const xp = clamp(normalizeInteger(entry?.xp, 0), 0, getPetMaxXp())
  entry.xp = xp
  entry.level = resolvePetLevelFromXp(xp)
  return entry
}

function gainPetXp(entry, amount) {
  const beforeXp = clamp(normalizeInteger(entry?.xp, 0), 0, getPetMaxXp())
  const beforeLevel = resolvePetLevelFromXp(beforeXp)
  const xpGained = Math.max(0, normalizeInteger(amount, 0))
  const afterXp = clamp(beforeXp + xpGained, 0, getPetMaxXp())
  entry.xp = afterXp
  entry.level = resolvePetLevelFromXp(afterXp)

  return {
    xpBefore: beforeXp,
    xpAfter: afterXp,
    levelBefore: beforeLevel,
    levelAfter: entry.level,
    xpGained: afterXp - beforeXp
  }
}

function getPetEffectiveInterceptPercent(entry) {
  const baseIntercept = Math.max(0, Math.min(100, normalizeInteger(entry?.guardInterceptPercentSnapshot, 0)))
  const level = clamp(normalizeInteger(entry?.level, 1), 1, FARM_PET_MAX_LEVEL)
  const fatigue = clamp(normalizeInteger(entry?.fatigue, 0), 0, 100)
  return clamp(
    baseIntercept + ((level - 1) * 3) - Math.floor(fatigue / 10),
    FARM_PET_MIN_INTERCEPT_PERCENT,
    FARM_PET_MAX_INTERCEPT_PERCENT
  )
}

function calculatePetFeedAddedHours(entry, food) {
  const baseHours = Math.max(1, normalizeInteger(food?.guardHours, 1))
  const guardBonusPercent = Math.max(0, normalizeInteger(entry?.guardBonusPercentSnapshot, 0))
  const level = clamp(normalizeInteger(entry?.level, 1), 1, FARM_PET_MAX_LEVEL)
  const fatigue = clamp(normalizeInteger(entry?.fatigue, 0), 0, 100)
  const fatigueMultiplier = Math.max(0.5, 1 - (fatigue / 200))
  const levelMultiplier = 1 + ((level - 1) * 0.05)
  const bonusMultiplier = 1 + (guardBonusPercent / 100)
  return Math.max(1, Math.floor(baseHours * bonusMultiplier * levelMultiplier * fatigueMultiplier))
}

function buildPetFoodSnapshot(food) {
  if (!food) {
    return null
  }

  const guardHours = Math.max(1, normalizeInteger(food.guardHours, 1))
  return {
    alias: normalizeAlias(food.alias),
    name: String(food.name || '').trim(),
    price: Math.max(0, normalizeInteger(food.price, 0)),
    guardHours,
    tier: Math.max(1, normalizeInteger(food.tier, FARM_PET_DEFAULT_FOOD_TIER)),
    xpReward: Math.max(0, normalizeInteger(food.xpReward, guardHours)),
    fatigueRecovery: Math.max(0, normalizeInteger(food.fatigueRecovery, guardHours * 3))
  }
}

function gainFarmXp(state, amount) {
  const normalizedAmount = Math.max(0, normalizeInteger(amount, 0))
  const beforeXp = state.farmXp
  const beforeLevel = state.farmLevel

  if (normalizedAmount <= 0) {
    return {
      xpGained: 0,
      levelBefore: beforeLevel,
      levelAfter: beforeLevel,
      totalXpBefore: beforeXp,
      totalXpAfter: beforeXp
    }
  }

  state.farmXp += normalizedAmount
  state.farmLevel = resolveFarmLevelFromXp(state.farmXp)

  return {
    xpGained: normalizedAmount,
    levelBefore: beforeLevel,
    levelAfter: state.farmLevel,
    totalXpBefore: beforeXp,
    totalXpAfter: state.farmXp
  }
}

function ensureFarmLevelConsistency(state) {
  state.farmXp = Math.max(0, normalizeInteger(state.farmXp, 0))
  state.farmLevel = resolveFarmLevelFromXp(state.farmXp)
}

function getCropByAlias(alias) {
  return farmRegistry.crops[normalizeAlias(alias)] || null
}

function getPetByAlias(alias) {
  return farmRegistry.pets[normalizeAlias(alias)] || null
}

function getPetFoodByAlias(alias) {
  return farmRegistry.petFoods[normalizeAlias(alias)] || null
}

function getSeedEntry(state, alias) {
  return state.seeds?.[normalizeAlias(alias)] || null
}

function getCropEntry(state, alias) {
  return state.crops?.[normalizeAlias(alias)] || null
}

function getPetEntry(state, alias) {
  return state.pets?.[normalizeAlias(alias)] || null
}

function getPetFoodEntry(state, alias) {
  return state.petFoods?.[normalizeAlias(alias)] || null
}

function getPlotById(state, plotId) {
  return state.plots.find(plot => plot.plotId === Number(plotId)) || null
}

function parseFarmPlotTarget(state, target, options = {}) {
  const targetText = String(target || '').trim().toLowerCase()
  if (options.allowAll && targetText === 'all') {
    return {
      ok: true,
      isAll: true,
      targetText,
      plotTarget: 'all',
      plots: [...state.plots]
    }
  }

  const targetMatch = targetText.match(/^(\d+)(?:-(\d+))?$/)
  if (!targetMatch) {
    return { ok: false, reason: 'plot_out_of_range' }
  }

  let startPlotId = parseInt(targetMatch[1])
  let endPlotId = targetMatch[2] ? parseInt(targetMatch[2]) : startPlotId
  if (!Number.isInteger(startPlotId) || !Number.isInteger(endPlotId)) {
    return { ok: false, reason: 'plot_out_of_range' }
  }

  if (startPlotId > endPlotId) {
    [startPlotId, endPlotId] = [endPlotId, startPlotId]
  }

  const plots = []
  for (let currentPlotId = startPlotId; currentPlotId <= endPlotId; currentPlotId++) {
    const plot = getPlotById(state, currentPlotId)
    if (!plot) {
      return { ok: false, reason: 'plot_out_of_range' }
    }
    plots.push(plot)
  }

  return {
    ok: true,
    isAll: false,
    targetText,
    plotTarget: startPlotId === endPlotId ? String(startPlotId) : `${startPlotId}-${endPlotId}`,
    plots
  }
}

function getActivePetEntry(state) {
  return state.activePetAlias ? getPetEntry(state, state.activePetAlias) : null
}

function getStoredPetFoodDefinition(entry) {
  if (!entry) {
    return null
  }

  return buildPetFoodSnapshot({
    alias: entry.foodAlias,
    name: entry.nameSnapshot,
    price: entry.priceSnapshot,
    guardHours: entry.guardHoursSnapshot,
    tier: entry.tierSnapshot,
    xpReward: entry.xpRewardSnapshot,
    fatigueRecovery: entry.fatigueRecoverySnapshot
  })
}

function resolvePetFoodForUse(state, alias) {
  return getPetFoodByAlias(alias) || getStoredPetFoodDefinition(getPetFoodEntry(state, alias))
}

function isPlotEmpty(plot) {
  return !plot?.cropAlias
}

function isPlotReady(plot, now = Date.now()) {
  return Boolean(plot?.owned) && !isPlotEmpty(plot) && (plot.readyAt || 0) <= now
}

function isCropUnlockedForState(crop, state) {
  return Boolean(crop) && (crop.unlockLevel || 1) <= state.farmLevel
}

function isFarmSocialUnlocked(state) {
  return state.farmLevel >= FARM_STEAL_UNLOCK_LEVEL
}

function pushFarmNotification(state, message) {
  const text = String(message || '').trim()
  if (!text) {
    return
  }

  state.notifications = Array.isArray(state.notifications) ? state.notifications : []
  state.notifications.push(text)
  if (state.notifications.length > FARM_NOTIFICATION_LIMIT) {
    state.notifications = state.notifications.slice(-FARM_NOTIFICATION_LIMIT)
  }
}

function normalizeSeedEntry(alias, entry) {
  const cropAlias = normalizeAlias(alias)
  const count = normalizeCount(entry?.count)
  if (!cropAlias || !FARM_ALIAS_PATTERN.test(cropAlias) || !isPositiveInteger(count)) {
    return null
  }

  return {
    cropAlias,
    count,
    nameSnapshot: String(entry?.nameSnapshot || '').trim(),
    seedNameSnapshot: String(entry?.seedNameSnapshot || '').trim(),
    seedPriceSnapshot: Math.max(0, normalizeInteger(entry?.seedPriceSnapshot, 0))
  }
}

function normalizeCropEntry(alias, entry) {
  const cropAlias = normalizeAlias(alias)
  const count = normalizeCount(entry?.count)
  if (!cropAlias || !FARM_ALIAS_PATTERN.test(cropAlias) || !isPositiveInteger(count)) {
    return null
  }

  return {
    cropAlias,
    count,
    nameSnapshot: String(entry?.nameSnapshot || '').trim(),
    sellPriceSnapshot: Math.max(0, normalizeInteger(entry?.sellPriceSnapshot, 0))
  }
}

function normalizePetEntry(alias, entry) {
  const petAlias = normalizeAlias(alias)
  if (!petAlias || !FARM_ALIAS_PATTERN.test(petAlias) || !entry || typeof entry !== 'object') {
    return null
  }

  const rawLevel = normalizeInteger(entry?.level, 0)
  const xp = Number.isFinite(Number(entry?.xp)) && Number(entry?.xp) >= 0
    ? clamp(normalizeInteger(entry?.xp, 0), 0, getPetMaxXp())
    : (isPositiveInteger(rawLevel) ? getPetLevelStartXp(rawLevel) : 0)
  const levelInfo = getPetLevelProgressInfo(xp)

  return syncPetLevel({
    petAlias,
    nameSnapshot: String(entry?.nameSnapshot || '').trim(),
    guardInterceptPercentSnapshot: Math.max(0, Math.min(100, normalizeInteger(entry?.guardInterceptPercentSnapshot, 0))),
    guardBaseHoursSnapshot: Math.max(1, normalizeInteger(entry?.guardBaseHoursSnapshot, FARM_PET_DEFAULT_GUARD_BASE_HOURS)),
    guardBonusPercentSnapshot: Math.max(0, normalizeInteger(entry?.guardBonusPercentSnapshot, FARM_PET_DEFAULT_GUARD_BONUS_PERCENT)),
    fatigueGainPerHourSnapshot: Math.max(0, normalizeInteger(entry?.fatigueGainPerHourSnapshot, FARM_PET_DEFAULT_FATIGUE_GAIN_PER_HOUR)),
    boughtAt: Number(entry?.boughtAt) || 0,
    guardUntil: Math.max(0, Number(entry?.guardUntil) || 0),
    level: levelInfo.level,
    xp,
    fatigue: clamp(normalizeInteger(entry?.fatigue, 0), 0, 100),
    lifecycleSyncedAt: Math.max(0, Number(entry?.lifecycleSyncedAt) || 0),
    activeProgressMs: clamp(normalizeInteger(entry?.activeProgressMs, 0), 0, HOUR_MS - 1),
    restProgressMs: clamp(normalizeInteger(entry?.restProgressMs, 0), 0, HOUR_MS - 1)
  })
}

function normalizePetFoodEntry(alias, entry) {
  const foodAlias = normalizeAlias(alias)
  const count = normalizeCount(entry?.count)
  if (!foodAlias || !FARM_ALIAS_PATTERN.test(foodAlias) || !isPositiveInteger(count)) {
    return null
  }

  return {
    foodAlias,
    count,
    nameSnapshot: String(entry?.nameSnapshot || '').trim(),
    guardHoursSnapshot: Math.max(0, normalizeInteger(entry?.guardHoursSnapshot, 0)),
    priceSnapshot: Math.max(0, normalizeInteger(entry?.priceSnapshot, 0)),
    tierSnapshot: Math.max(1, normalizeInteger(entry?.tierSnapshot, FARM_PET_DEFAULT_FOOD_TIER)),
    xpRewardSnapshot: Math.max(0, normalizeInteger(entry?.xpRewardSnapshot, normalizeInteger(entry?.guardHoursSnapshot, 0))),
    fatigueRecoverySnapshot: Math.max(0, normalizeInteger(entry?.fatigueRecoverySnapshot, Math.max(0, normalizeInteger(entry?.guardHoursSnapshot, 0)) * 3))
  }
}

function normalizePlot(rawPlot, index) {
  const land = LAND_CONFIG[index]
  const emptyPlot = createEmptyPlot(land.plotId)
  const plot = rawPlot && typeof rawPlot === 'object' ? rawPlot : {}
  const owned = land.defaultOwned ? true : Boolean(plot.owned)
  const cropAlias = normalizeAlias(plot.cropAlias)

  if (!cropAlias) {
    return {
      ...emptyPlot,
      owned
    }
  }

  const legacyYield = Math.max(0, normalizeInteger(plot.yieldTotalSnapshot, 0))
  const migratedYield = Math.max(0, normalizeInteger(plot.harvestYieldSnapshot, 0))

  return {
    plotId: land.plotId,
    landType: land.landType,
    owned,
    cropAlias,
    nameSnapshot: String(plot.nameSnapshot || '').trim(),
    sellPriceSnapshot: Math.max(0, normalizeInteger(plot.sellPriceSnapshot, 0)),
    yieldTotalSnapshot: legacyYield || migratedYield || 1,
    yieldStolen: Math.max(0, normalizeInteger(plot.yieldStolen, 0)),
    growMinutesSnapshot: normalizePositiveNumber(plot.growMinutesSnapshot, 1),
    waterStaminaSnapshot: Math.max(0, normalizeInteger(plot.waterStaminaSnapshot, 0)),
    waterBaseReductionPercentSnapshot: Math.max(0, Math.min(100, normalizeInteger(plot.waterBaseReductionPercentSnapshot, 0))),
    plantedAt: Number(plot.plantedAt) || 0,
    readyAt: Number(plot.readyAt) || 0,
    watered: Boolean(plot.watered)
  }
}

function normalizeOrderRequirement(rawRequirement) {
  if (!rawRequirement || typeof rawRequirement !== 'object' || Array.isArray(rawRequirement)) {
    return null
  }

  const cropAlias = normalizeAlias(rawRequirement.cropAlias)
  const requiredQty = normalizeInteger(rawRequirement.requiredQty, 0)
  if (!cropAlias || !FARM_ALIAS_PATTERN.test(cropAlias) || !isPositiveInteger(requiredQty)) {
    return null
  }

  return {
    cropAlias,
    cropNameSnapshot: String(rawRequirement.cropNameSnapshot || rawRequirement.nameSnapshot || '').trim(),
    requiredQty
  }
}

function normalizeOrder(order, index, expiresAt) {
  if (!order || typeof order !== 'object') {
    return null
  }

  const requirementsSource = Array.isArray(order.requirements) && order.requirements.length
    ? order.requirements
    : [order]
  const requirements = []
  const seenAliases = new Set()

  for (const rawRequirement of requirementsSource) {
    const requirement = normalizeOrderRequirement(rawRequirement)
    if (!requirement || seenAliases.has(requirement.cropAlias)) {
      return null
    }

    seenAliases.add(requirement.cropAlias)
    requirements.push(requirement)
  }

  if (!requirements.length) {
    return null
  }

  return {
    slot: index + 1,
    requirements,
    coinReward: Math.max(0, normalizeInteger(order.coinReward, 0)),
    favorReward: Math.max(0, normalizeInteger(order.favorReward, 0)),
    expiresAt: Number(order.expiresAt) || expiresAt || 0
  }
}

function normalizeStats(rawStats) {
  const stats = {
    ...createDefaultFarmStats(),
    ...(rawStats && typeof rawStats === 'object' ? rawStats : {})
  }

  stats.openFarmCount = Math.max(0, normalizeInteger(stats.openFarmCount, 0))
  stats.buySeedCount = Math.max(0, normalizeInteger(stats.buySeedCount, 0))
  stats.plantCount = Math.max(0, normalizeInteger(stats.plantCount, 0))
  stats.waterCount = Math.max(0, normalizeInteger(stats.waterCount, 0))
  stats.harvestUnits = Math.max(0, normalizeInteger(stats.harvestUnits, 0))
  stats.sellCropUnits = Math.max(0, normalizeInteger(stats.sellCropUnits, 0))
  stats.deliverOrderCount = Math.max(0, normalizeInteger(stats.deliverOrderCount, 0))
  stats.buyPlotCount = Math.max(0, normalizeInteger(stats.buyPlotCount, 0))
  stats.boughtPlotIds = [...new Set((Array.isArray(stats.boughtPlotIds) ? stats.boughtPlotIds : [])
    .map(plotId => normalizeInteger(plotId, 0))
    .filter(plotId => plotId >= 1 && plotId <= FARM_PLOT_COUNT))]
  stats.harvestOnLand = {
    normal: Math.max(0, normalizeInteger(stats.harvestOnLand?.normal, 0)),
    yellow: Math.max(0, normalizeInteger(stats.harvestOnLand?.yellow, 0)),
    black: Math.max(0, normalizeInteger(stats.harvestOnLand?.black, 0))
  }
  stats.collectedCropAliases = [...new Set((Array.isArray(stats.collectedCropAliases) ? stats.collectedCropAliases : [])
    .map(alias => normalizeAlias(alias))
    .filter(alias => alias && FARM_ALIAS_PATTERN.test(alias)))]
  stats.buyPetCount = Math.max(0, normalizeInteger(stats.buyPetCount, 0))
  stats.buyPetFoodCount = Math.max(0, normalizeInteger(stats.buyPetFoodCount, 0))
  stats.feedPetAddedMs = Math.max(0, Number(stats.feedPetAddedMs) || 0)
  stats.visitFarmCount = Math.max(0, normalizeInteger(stats.visitFarmCount, 0))
  stats.attemptStealCount = Math.max(0, normalizeInteger(stats.attemptStealCount, 0))
  stats.successfulStealCount = Math.max(0, normalizeInteger(stats.successfulStealCount, 0))
  stats.stolenUnits = Math.max(0, normalizeInteger(stats.stolenUnits, 0))
  stats.guardAccumulatedMs = Math.max(0, Number(stats.guardAccumulatedMs) || 0)

  return stats
}

function normalizeDailyStats(rawStats) {
  const stats = {
    ...createDefaultDailyFarmStats(),
    ...(rawStats && typeof rawStats === 'object' ? rawStats : {})
  }

  stats.openFarmCount = Math.max(0, normalizeInteger(stats.openFarmCount, 0))
  stats.buySeedCount = Math.max(0, normalizeInteger(stats.buySeedCount, 0))
  stats.plantCount = Math.max(0, normalizeInteger(stats.plantCount, 0))
  stats.waterCount = Math.max(0, normalizeInteger(stats.waterCount, 0))
  stats.harvestUnits = Math.max(0, normalizeInteger(stats.harvestUnits, 0))
  stats.sellCropUnits = Math.max(0, normalizeInteger(stats.sellCropUnits, 0))
  stats.deliverOrderCount = Math.max(0, normalizeInteger(stats.deliverOrderCount, 0))

  return stats
}

function normalizeDailyTask(rawTask) {
  if (!rawTask || typeof rawTask !== 'object' || Array.isArray(rawTask)) {
    return null
  }

  const templateId = normalizeAlias(rawTask.templateId)
  const type = normalizeAlias(rawTask.type)
  const title = String(rawTask.title || '').trim()
  const target = Math.max(0, normalizeInteger(rawTask.target, 0))
  if (!templateId || !type || !title || !isPositiveInteger(target)) {
    return null
  }

  return {
    templateId,
    type,
    title,
    target,
    progress: Math.max(0, normalizeInteger(rawTask.progress, 0)),
    coinReward: Math.max(0, normalizeInteger(rawTask.coinReward, 0)),
    xpReward: Math.max(0, normalizeInteger(rawTask.xpReward, 0)),
    completedAt: Math.max(0, Number(rawTask.completedAt) || 0)
  }
}

function normalizeQuestState(chapterId, rawState) {
  const state = rawState && typeof rawState === 'object' ? rawState : {}
  return {
    chapterId,
    currentStep: Math.max(0, normalizeInteger(state.currentStep, 0)),
    progress: Math.max(0, normalizeInteger(state.progress, 0)),
    completedAt: Math.max(0, Number(state.completedAt) || 0)
  }
}

function hasLegacyFarmProgress(rawState) {
  if (!rawState || typeof rawState !== 'object' || rawState.stateVersion === 2) {
    return false
  }

  return Array.isArray(rawState.plots)
    || Object.keys(rawState.seeds || {}).length > 0
    || Object.keys(rawState.crops || {}).length > 0
    || Array.isArray(rawState.orders)
    || Boolean(rawState.createdAt)
    || Boolean(rawState.starterGrantApplied)
}

function sanitizeFarmState(rawState, options = {}) {
  const source = rawState && typeof rawState === 'object' ? rawState : {}
  const normalized = {
    ...createDefaultFarmState(),
    ...source
  }

  normalized.stateVersion = 2
  normalized.starterGrantApplied = Boolean(normalized.starterGrantApplied)
  normalized.plots = LAND_CONFIG.map((_, index) => normalizePlot(source.plots?.[index], index))
  normalized.seeds = Object.fromEntries(
    Object.entries(source.seeds || {})
      .map(([alias, entry]) => [normalizeAlias(alias), normalizeSeedEntry(alias, entry)])
      .filter(([, entry]) => Boolean(entry))
  )
  normalized.crops = Object.fromEntries(
    Object.entries(source.crops || {})
      .map(([alias, entry]) => [normalizeAlias(alias), normalizeCropEntry(alias, entry)])
      .filter(([, entry]) => Boolean(entry))
  )
  normalized.pets = Object.fromEntries(
    Object.entries(source.pets || {})
      .map(([alias, entry]) => [normalizeAlias(alias), normalizePetEntry(alias, entry)])
      .filter(([, entry]) => Boolean(entry))
  )
  normalized.petFoods = Object.fromEntries(
    Object.entries(source.petFoods || {})
      .map(([alias, entry]) => [normalizeAlias(alias), normalizePetFoodEntry(alias, entry)])
      .filter(([, entry]) => Boolean(entry))
  )
  normalized.activePetAlias = normalizeAlias(source.activePetAlias)
  if (normalized.activePetAlias && !normalized.pets[normalized.activePetAlias]) {
    normalized.activePetAlias = ''
  }
  normalized.guardTrackedAt = Math.max(0, Number(source.guardTrackedAt) || 0)
  normalized.stats = normalizeStats(source.stats)
  normalized.mainQuests = Object.fromEntries(
    Object.entries(source.mainQuests || {})
      .map(([chapterId, questState]) => [normalizeAlias(chapterId), normalizeQuestState(chapterId, questState)])
      .filter(([chapterId]) => Boolean(chapterId))
  )
  normalized.notifications = (Array.isArray(source.notifications) ? source.notifications : [])
    .map(item => String(item || '').trim())
    .filter(Boolean)
    .slice(-FARM_NOTIFICATION_LIMIT)
  normalized.orders = Array.from({ length: FARM_ORDER_SLOT_COUNT }, (_, index) =>
    normalizeOrder(source.orders?.[index], index, source.orderBoardExpiresAt)
  ).filter(Boolean)
  normalized.orderBoardExpiresAt = Math.max(0, Number(source.orderBoardExpiresAt) || 0)
  normalized.dailyTaskDayKey = Math.max(0, normalizeInteger(source.dailyTaskDayKey, 0))
  normalized.dailyStats = normalizeDailyStats(source.dailyStats)
  normalized.dailyTasks = (Array.isArray(source.dailyTasks) ? source.dailyTasks : [])
    .map(task => normalizeDailyTask(task))
    .filter(Boolean)
    .slice(0, FARM_DAILY_TASK_SLOT_COUNT)
  normalized.lastVisitedFarmUid = Math.max(0, normalizeInteger(source.lastVisitedFarmUid, 0))
  normalized.lastVisitedFarmAt = Math.max(0, Number(source.lastVisitedFarmAt) || 0)
  normalized.dailyStealDayKey = Math.max(0, normalizeInteger(source.dailyStealDayKey, 0))
  normalized.dailyStealAttempts = Math.max(0, normalizeInteger(source.dailyStealAttempts, 0))
  normalized.createdAt = String(source.createdAt || normalized.createdAt)

  if (Number.isFinite(Number(source.farmXp)) && Number(source.farmXp) >= 0) {
    normalized.farmXp = Math.max(0, normalizeInteger(source.farmXp, 0))
  } else if (isPositiveInteger(Number(source.farmLevel))) {
    normalized.farmXp = getLevelStartXp(Number(source.farmLevel))
  } else {
    normalized.farmXp = 0
  }

  if (options.legacyFarm) {
    normalized.farmXp = Math.max(normalized.farmXp, getLevelStartXp(20))
  }

  ensureFarmLevelConsistency(normalized)
  return normalized
}

function markFarmDataDirty() {
  farmDataDirty = true
}

function assertFarmPersistenceReady() {
  if (farmStateLoadError) {
    throw new Error(farmStateLoadError)
  }
}

function touchFarmState(state) {
  state.updatedAt = Date.now()
  markFarmDataDirty()
}

function serializeFarmStates() {
  return JSON.stringify(Object.fromEntries(
    [...farmStates.entries()].map(([userId, state]) => [userId, state])
  ), null, 2)
}

async function flushFarmData() {
  if (farmDataWriting) {
    return farmDataFlushPromise
  }

  farmDataWriting = true
  farmDataFlushPromise = (async () => {
    try {
      await fsp.mkdir(path.dirname(farmConfig.farmDataPath), { recursive: true })
      while (farmDataDirty) {
        const snapshot = serializeFarmStates()
        farmDataDirty = false
        try {
          await writeTextFileAtomically(farmConfig.farmDataPath, snapshot)
        } catch (error) {
          farmDataDirty = true
          throw error
        }
      }
    } catch (error) {
      console.error('[neow][farm] 保存农场数据失败:', error)
    } finally {
      farmDataWriting = false
      if (farmDataDirty) {
        void flushFarmData()
      }
    }
  })()

  return farmDataFlushPromise
}

function saveFarmData() {
  ensureFarmReady()
  assertFarmPersistenceReady()
  markFarmDataDirty()
  return flushFarmData()
}

function ensureFarmRuntimeDirs() {
  fs.mkdirSync(path.dirname(farmConfig.farmDataPath), { recursive: true })
  fs.mkdirSync(farmConfig.addonDirPath, { recursive: true })
}

function ensureFarmReady() {
  if (farmInitialized || farmInitializing) {
    return
  }

  farmInitializing = true
  farmAddonStatus = createEmptyFarmAddonStatus()
  farmInitialized = true

  try {
    ensureFarmRuntimeDirs()
    reloadFarmRegistry('startup')
    loadFarmStates()
    startFarmWatcher()
  } catch (error) {
    farmInitialized = false
    farmAddonStatus.lastReloadError = `初始化 farm 系统失败: ${error?.message || error}`
  } finally {
    farmInitializing = false
  }
}

function loadFarmStates() {
  const recovery = recoverSharedStateTransaction(sharedStateTransactionPath)
  if (recovery.error) {
    farmStateLoadError = recovery.error
    farmStates = new Map()
    return
  }

  farmStates = new Map()
  farmStateLoadError = ''
  let migratedLegacyState = false

  try {
    if (!fs.existsSync(farmConfig.farmDataPath)) {
      return
    }

    const raw = JSON.parse(fs.readFileSync(farmConfig.farmDataPath, 'utf8'))
    for (const [userId, state] of Object.entries(raw || {})) {
      const legacyFarm = hasLegacyFarmProgress(state)
      const normalizedState = sanitizeFarmState(state, { legacyFarm })
      if (legacyFarm && ensureQuestStates(normalizedState, { completeTutorial: true }, Date.now())) {
        migratedLegacyState = true
      }
      farmStates.set(normalizeUserId(userId), normalizedState)
    }
  } catch (error) {
    farmStates = new Map()
    farmStateLoadError = `读取 farm 存档失败: ${error?.message || error}`
    return
  }

  for (const state of farmStates.values()) {
    syncFarmState(state)
  }

  if (migratedLegacyState) {
    markFarmDataDirty()
    void flushFarmData()
  }
}

function syncAllFarmStates(now = Date.now()) {
  for (const state of farmStates.values()) {
    syncFarmState(state, now)
  }
}

function readJsonFile(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function makeSkipRecord(source, manifest, reason) {
  return {
    source,
    id: String(manifest?.id || '').trim(),
    name: String(manifest?.name || '').trim(),
    reason
  }
}

function validateManifestBase(manifest, source) {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    return { ok: false, reason: `${source} 不是合法的附加件对象` }
  }

  if (!FARM_SUPPORTED_SCHEMA_VERSIONS.includes(manifest.schemaVersion)) {
    return { ok: false, reason: `${source} 的 schemaVersion 必须为 1 或 2` }
  }

  const id = normalizeAlias(manifest.id)
  if (!id || !FARM_ALIAS_PATTERN.test(id)) {
    return { ok: false, reason: `${source} 的 id 不合法` }
  }

  const name = String(manifest.name || '').trim()
  if (!name) {
    return { ok: false, reason: `${source} 缺少 name` }
  }

  const version = String(manifest.version || '').trim()
  if (!version) {
    return { ok: false, reason: `${source} 缺少 version` }
  }

  if (typeof manifest.enabled !== 'boolean') {
    return { ok: false, reason: `${source} 的 enabled 必须是布尔值` }
  }

  if (!Number.isInteger(manifest.priority)) {
    return { ok: false, reason: `${source} 的 priority 必须是整数` }
  }

  if (!Array.isArray(manifest.starterGrants)) {
    return { ok: false, reason: `${source} 的 starterGrants 必须是数组` }
  }

  if (!Array.isArray(manifest.crops)) {
    return { ok: false, reason: `${source} 的 crops 必须是数组` }
  }

  if (!Array.isArray(manifest.orderTemplates)) {
    return { ok: false, reason: `${source} 的 orderTemplates 必须是数组` }
  }

  if (manifest.schemaVersion >= 2) {
    if (manifest.pets != null && !Array.isArray(manifest.pets)) {
      return { ok: false, reason: `${source} 的 pets 必须是数组` }
    }
    if (manifest.petFoods != null && !Array.isArray(manifest.petFoods)) {
      return { ok: false, reason: `${source} 的 petFoods 必须是数组` }
    }
    if (manifest.mainQuestChapters != null && !Array.isArray(manifest.mainQuestChapters)) {
      return { ok: false, reason: `${source} 的 mainQuestChapters 必须是数组` }
    }
  }

  return {
    ok: true,
    manifest: {
      schemaVersion: manifest.schemaVersion,
      id,
      name,
      version,
      enabled: manifest.enabled,
      priority: manifest.priority,
      starterGrants: manifest.starterGrants,
      crops: manifest.crops,
      orderTemplates: manifest.orderTemplates,
      pets: Array.isArray(manifest.pets) ? manifest.pets : [],
      petFoods: Array.isArray(manifest.petFoods) ? manifest.petFoods : [],
      mainQuestChapters: Array.isArray(manifest.mainQuestChapters) ? manifest.mainQuestChapters : []
    }
  }
}

function validateCropDefinition(rawCrop, source, schemaVersion) {
  if (!rawCrop || typeof rawCrop !== 'object' || Array.isArray(rawCrop)) {
    return { ok: false, reason: `${source} 的 crop 结构不合法` }
  }

  const alias = normalizeAlias(rawCrop.alias)
  if (!alias || !FARM_ALIAS_PATTERN.test(alias)) {
    return { ok: false, reason: `${source} 的 crop.alias 不合法` }
  }

  const name = String(rawCrop.name || '').trim()
  const seedName = String(rawCrop.seedName || '').trim()
  if (!name || !seedName) {
    return { ok: false, reason: `${source} 的 crop ${alias} 缺少名称` }
  }

  const numericFields = [
    ['seedPrice', rawCrop.seedPrice, isNonNegativeInteger],
    ['growMinutes', rawCrop.growMinutes, isPositiveInteger],
    ['plantStamina', rawCrop.plantStamina, isNonNegativeInteger],
    ['waterStamina', rawCrop.waterStamina, isNonNegativeInteger],
    ['waterBaseReductionPercent', rawCrop.waterBaseReductionPercent, value => isNonNegativeInteger(value) && value <= 100],
    ['harvestYield', rawCrop.harvestYield, isPositiveInteger],
    ['sellPrice', rawCrop.sellPrice, isNonNegativeInteger],
    ['orderFavorReward', rawCrop.orderFavorReward, isNonNegativeInteger]
  ]

  for (const [field, value, validator] of numericFields) {
    const normalizedValue = Number(value)
    if (!validator(normalizedValue)) {
      return { ok: false, reason: `${source} 的 crop ${alias}.${field} 不合法` }
    }
  }

  const unlockLevel = schemaVersion >= 2
    ? Math.max(1, normalizeInteger(rawCrop.unlockLevel, 1))
    : 1

  return {
    ok: true,
    crop: {
      alias,
      name,
      seedName,
      seedPrice: Number(rawCrop.seedPrice),
      growMinutes: Number(rawCrop.growMinutes),
      plantStamina: Number(rawCrop.plantStamina),
      waterStamina: Number(rawCrop.waterStamina),
      waterBaseReductionPercent: Number(rawCrop.waterBaseReductionPercent),
      harvestYield: Number(rawCrop.harvestYield),
      sellPrice: Number(rawCrop.sellPrice),
      orderFavorReward: Number(rawCrop.orderFavorReward),
      unlockLevel
    }
  }
}

function validateStarterGrant(grant, source, availableAliases) {
  if (!grant || typeof grant !== 'object' || Array.isArray(grant)) {
    return { ok: false, reason: `${source} 的 starterGrant 结构不合法` }
  }

  const cropAlias = normalizeAlias(grant.cropAlias)
  if (!cropAlias || !availableAliases.has(cropAlias)) {
    return { ok: false, reason: `${source} 的 starterGrant.cropAlias 不存在` }
  }

  const seedCount = Number(grant.seedCount || 0)
  const cropCount = Number(grant.cropCount || 0)
  if (!isNonNegativeInteger(seedCount) || !isNonNegativeInteger(cropCount)) {
    return { ok: false, reason: `${source} 的 starterGrant 数量不合法` }
  }

  if (seedCount <= 0 && cropCount <= 0) {
    return { ok: false, reason: `${source} 的 starterGrant 至少要发放一种物品` }
  }

  return {
    ok: true,
    grant: {
      cropAlias,
      seedCount,
      cropCount
    }
  }
}

function validateOrderRequirement(rawRequirement, source) {
  if (!rawRequirement || typeof rawRequirement !== 'object' || Array.isArray(rawRequirement)) {
    return { ok: false, reason: `${source} 结构不合法` }
  }

  const cropAlias = normalizeAlias(rawRequirement.cropAlias)
  if (!cropAlias || !FARM_ALIAS_PATTERN.test(cropAlias)) {
    return { ok: false, reason: `${source}.cropAlias 不合法` }
  }

  const qtyMin = Number(rawRequirement.qtyMin)
  const qtyMax = Number(rawRequirement.qtyMax)
  if (!isPositiveInteger(qtyMin) || !isPositiveInteger(qtyMax) || qtyMax < qtyMin) {
    return { ok: false, reason: `${source} 数量范围不合法` }
  }

  return {
    ok: true,
    requirement: {
      cropAlias,
      qtyMin,
      qtyMax
    }
  }
}

function validateOrderTemplate(rawTemplate, source) {
  if (!rawTemplate || typeof rawTemplate !== 'object' || Array.isArray(rawTemplate)) {
    return { ok: false, reason: `${source} 的 orderTemplate 结构不合法` }
  }

  const requirementsSource = Array.isArray(rawTemplate.requirements) && rawTemplate.requirements.length
    ? rawTemplate.requirements
    : [rawTemplate]
  const requirements = []
  const seenAliases = new Set()

  for (const [index, rawRequirement] of requirementsSource.entries()) {
    const requirementResult = validateOrderRequirement(
      rawRequirement,
      Array.isArray(rawTemplate.requirements)
        ? `${source} 的 orderTemplate.requirements[${index}]`
        : `${source} 的 orderTemplate`
    )
    if (!requirementResult.ok) {
      return requirementResult
    }

    if (seenAliases.has(requirementResult.requirement.cropAlias)) {
      return { ok: false, reason: `${source} 的 orderTemplate 重复声明了 ${requirementResult.requirement.cropAlias}` }
    }

    seenAliases.add(requirementResult.requirement.cropAlias)
    requirements.push(requirementResult.requirement)
  }

  const coinBonusPerUnit = Number(rawTemplate.coinBonusPerUnit)
  const weight = Number(rawTemplate.weight)

  if (!isNonNegativeInteger(coinBonusPerUnit)) {
    return { ok: false, reason: `${source} 的 orderTemplate coinBonusPerUnit 不合法` }
  }

  if (!isPositiveInteger(weight)) {
    return { ok: false, reason: `${source} 的 orderTemplate weight 不合法` }
  }

  return {
    ok: true,
    template: {
      requirements,
      coinBonusPerUnit,
      weight
    }
  }
}

function validatePetDefinition(rawPet, source) {
  if (!rawPet || typeof rawPet !== 'object' || Array.isArray(rawPet)) {
    return { ok: false, reason: `${source} 的 pet 结构不合法` }
  }

  const alias = normalizeAlias(rawPet.alias)
  if (!alias || !FARM_ALIAS_PATTERN.test(alias)) {
    return { ok: false, reason: `${source} 的 pet.alias 不合法` }
  }

  const name = String(rawPet.name || '').trim()
  if (!name) {
    return { ok: false, reason: `${source} 的 pet ${alias} 缺少名称` }
  }

  const price = Number(rawPet.price)
  const guardInterceptPercent = Number(rawPet.guardInterceptPercent)
  const guardBaseHours = rawPet.guardBaseHours == null
    ? FARM_PET_DEFAULT_GUARD_BASE_HOURS
    : Number(rawPet.guardBaseHours)
  const guardBonusPercent = rawPet.guardBonusPercent == null
    ? FARM_PET_DEFAULT_GUARD_BONUS_PERCENT
    : Number(rawPet.guardBonusPercent)
  const fatigueGainPerHour = rawPet.fatigueGainPerHour == null
    ? FARM_PET_DEFAULT_FATIGUE_GAIN_PER_HOUR
    : Number(rawPet.fatigueGainPerHour)
  if (!isNonNegativeInteger(price)) {
    return { ok: false, reason: `${source} 的 pet ${alias}.price 不合法` }
  }

  if (!isNonNegativeInteger(guardInterceptPercent) || guardInterceptPercent > 100) {
    return { ok: false, reason: `${source} 的 pet ${alias}.guardInterceptPercent 不合法` }
  }

  if (!isPositiveInteger(guardBaseHours)) {
    return { ok: false, reason: `${source} 的 pet ${alias}.guardBaseHours 不合法` }
  }

  if (!isNonNegativeInteger(guardBonusPercent)) {
    return { ok: false, reason: `${source} 的 pet ${alias}.guardBonusPercent 不合法` }
  }

  if (!isNonNegativeInteger(fatigueGainPerHour)) {
    return { ok: false, reason: `${source} 的 pet ${alias}.fatigueGainPerHour 不合法` }
  }

  return {
    ok: true,
    pet: {
      alias,
      name,
      price,
      guardInterceptPercent,
      guardBaseHours,
      guardBonusPercent,
      fatigueGainPerHour
    }
  }
}

function validatePetFoodDefinition(rawFood, source) {
  if (!rawFood || typeof rawFood !== 'object' || Array.isArray(rawFood)) {
    return { ok: false, reason: `${source} 的 petFood 结构不合法` }
  }

  const alias = normalizeAlias(rawFood.alias)
  if (!alias || !FARM_ALIAS_PATTERN.test(alias)) {
    return { ok: false, reason: `${source} 的 petFood.alias 不合法` }
  }

  const name = String(rawFood.name || '').trim()
  if (!name) {
    return { ok: false, reason: `${source} 的 petFood ${alias} 缺少名称` }
  }

  const price = Number(rawFood.price)
  const guardHours = Number(rawFood.guardHours)
  const tier = rawFood.tier == null
    ? FARM_PET_DEFAULT_FOOD_TIER
    : Number(rawFood.tier)
  const xpReward = rawFood.xpReward == null
    ? guardHours
    : Number(rawFood.xpReward)
  const fatigueRecovery = rawFood.fatigueRecovery == null
    ? (guardHours * 3)
    : Number(rawFood.fatigueRecovery)
  if (!isNonNegativeInteger(price)) {
    return { ok: false, reason: `${source} 的 petFood ${alias}.price 不合法` }
  }

  if (!isPositiveInteger(guardHours)) {
    return { ok: false, reason: `${source} 的 petFood ${alias}.guardHours 不合法` }
  }

  if (!isPositiveInteger(tier)) {
    return { ok: false, reason: `${source} 的 petFood ${alias}.tier 不合法` }
  }

  if (!isNonNegativeInteger(xpReward)) {
    return { ok: false, reason: `${source} 的 petFood ${alias}.xpReward 不合法` }
  }

  if (!isNonNegativeInteger(fatigueRecovery)) {
    return { ok: false, reason: `${source} 的 petFood ${alias}.fatigueRecovery 不合法` }
  }

  return {
    ok: true,
    petFood: {
      alias,
      name,
      price,
      guardHours,
      tier,
      xpReward,
      fatigueRecovery
    }
  }
}

function validateQuestReward(rawReward, source, availableCropAliases, availableFoodAliases) {
  if (rawReward == null) {
    return { ok: true, reward: null }
  }

  if (!rawReward || typeof rawReward !== 'object' || Array.isArray(rawReward)) {
    return { ok: false, reason: `${source} 的 reward 结构不合法` }
  }

  const reward = {
    coins: Math.max(0, normalizeInteger(rawReward.coins, 0)),
    xp: Math.max(0, normalizeInteger(rawReward.xp, 0)),
    fillToLevel: rawReward.fillToLevel == null ? 0 : Math.max(0, normalizeInteger(rawReward.fillToLevel, 0)),
    seeds: [],
    petFoods: []
  }

  if (rawReward.seeds != null) {
    if (!Array.isArray(rawReward.seeds)) {
      return { ok: false, reason: `${source} 的 reward.seeds 必须是数组` }
    }

    for (const entry of rawReward.seeds) {
      const cropAlias = normalizeAlias(entry?.cropAlias)
      const count = Number(entry?.count)
      if (!cropAlias || !availableCropAliases.has(cropAlias) || !isPositiveInteger(count)) {
        return { ok: false, reason: `${source} 的 reward.seeds 声明不合法` }
      }

      reward.seeds.push({ cropAlias, count })
    }
  }

  if (rawReward.petFoods != null) {
    if (!Array.isArray(rawReward.petFoods)) {
      return { ok: false, reason: `${source} 的 reward.petFoods 必须是数组` }
    }

    for (const entry of rawReward.petFoods) {
      const foodAlias = normalizeAlias(entry?.foodAlias)
      const count = Number(entry?.count)
      if (!foodAlias || !availableFoodAliases.has(foodAlias) || !isPositiveInteger(count)) {
        return { ok: false, reason: `${source} 的 reward.petFoods 声明不合法` }
      }

      reward.petFoods.push({ foodAlias, count })
    }
  }

  return { ok: true, reward }
}

function validateQuestStep(rawStep, source, availableCropAliases, availableFoodAliases) {
  if (!rawStep || typeof rawStep !== 'object' || Array.isArray(rawStep)) {
    return { ok: false, reason: `${source} 的 quest step 结构不合法` }
  }

  const type = String(rawStep.type || '').trim()
  if (!FARM_QUEST_STEP_TYPES.has(type)) {
    return { ok: false, reason: `${source} 的 quest step.type ${type || '(empty)'} 不受支持` }
  }

  const target = Number(rawStep.target)
  if (!isPositiveInteger(target)) {
    return { ok: false, reason: `${source} 的 quest step ${type}.target 必须是正整数` }
  }

  if (rawStep.landType != null && !LAND_TYPE_LABELS[String(rawStep.landType)]) {
    return { ok: false, reason: `${source} 的 quest step ${type}.landType 不合法` }
  }

  if (rawStep.plotId != null) {
    const plotId = Number(rawStep.plotId)
    if (!isPositiveInteger(plotId) || plotId > FARM_PLOT_COUNT) {
      return { ok: false, reason: `${source} 的 quest step ${type}.plotId 不合法` }
    }
  }

  const rewardResult = validateQuestReward(rawStep.reward, source, availableCropAliases, availableFoodAliases)
  if (!rewardResult.ok) {
    return rewardResult
  }

  return {
    ok: true,
    step: {
      type,
      target,
      label: String(rawStep.label || '').trim(),
      landType: rawStep.landType ? String(rawStep.landType) : '',
      plotId: rawStep.plotId == null ? 0 : Number(rawStep.plotId),
      reward: rewardResult.reward
    }
  }
}

function validateQuestChapter(rawChapter, source, availableCropAliases, availableFoodAliases) {
  if (!rawChapter || typeof rawChapter !== 'object' || Array.isArray(rawChapter)) {
    return { ok: false, reason: `${source} 的 mainQuestChapter 结构不合法` }
  }

  const id = normalizeAlias(rawChapter.id)
  if (!id || !FARM_ALIAS_PATTERN.test(id)) {
    return { ok: false, reason: `${source} 的 mainQuestChapter.id 不合法` }
  }

  const name = String(rawChapter.name || '').trim()
  if (!name) {
    return { ok: false, reason: `${source} 的 mainQuestChapter ${id} 缺少 name` }
  }

  if (!Array.isArray(rawChapter.steps) || !rawChapter.steps.length) {
    return { ok: false, reason: `${source} 的 mainQuestChapter ${id} 必须至少包含 1 个 step` }
  }

  const steps = []
  for (const rawStep of rawChapter.steps) {
    const result = validateQuestStep(rawStep, source, availableCropAliases, availableFoodAliases)
    if (!result.ok) {
      return result
    }
    steps.push(result.step)
  }

  return {
    ok: true,
    chapter: {
      id,
      name,
      description: String(rawChapter.description || '').trim(),
      steps
    }
  }
}

function loadAddonCandidates() {
  const skippedAddons = []
  const loadedCandidates = []
  const coreSource = farmConfig.coreAddonPath
  let coreManifest

  try {
    coreManifest = readJsonFile(coreSource)
  } catch (error) {
    return {
      ok: false,
      error: `读取内置 farm core 包失败: ${error?.message || error}`,
      skippedAddons,
      loadedCandidates
    }
  }

  const validatedCore = validateManifestBase(coreManifest, coreSource)
  if (!validatedCore.ok) {
    return {
      ok: false,
      error: validatedCore.reason,
      skippedAddons,
      loadedCandidates
    }
  }

  loadedCandidates.push({
    source: coreSource,
    sourceType: 'core',
    manifest: validatedCore.manifest
  })

  let addonFiles = []
  try {
    addonFiles = fs.readdirSync(farmConfig.addonDirPath)
      .filter(file => file.endsWith('.json'))
      .sort((left, right) => left.localeCompare(right, 'en'))
  } catch (error) {
    return {
      ok: false,
      error: `读取 farm 附加件目录失败: ${error?.message || error}`,
      skippedAddons,
      loadedCandidates
    }
  }

  for (const file of addonFiles) {
    const filePath = path.join(farmConfig.addonDirPath, file)
    let manifest

    try {
      manifest = readJsonFile(filePath)
    } catch (error) {
      skippedAddons.push(makeSkipRecord(filePath, null, `JSON 解析失败: ${error?.message || error}`))
      continue
    }

    const validatedManifest = validateManifestBase(manifest, filePath)
    if (!validatedManifest.ok) {
      skippedAddons.push(makeSkipRecord(filePath, manifest, validatedManifest.reason))
      continue
    }

    loadedCandidates.push({
      source: filePath,
      sourceType: 'external',
      manifest: validatedManifest.manifest
    })
  }

  const [coreCandidate, ...externalCandidates] = loadedCandidates
  externalCandidates.sort((left, right) => {
    if (left.manifest.priority !== right.manifest.priority) {
      return right.manifest.priority - left.manifest.priority
    }

    return left.manifest.id.localeCompare(right.manifest.id, 'en')
  })

  return {
    ok: true,
    skippedAddons,
    loadedCandidates: [coreCandidate, ...externalCandidates]
  }
}

function buildFarmRegistryFromDisk() {
  const candidateResult = loadAddonCandidates()
  if (!candidateResult.ok) {
    return candidateResult
  }

  const registry = createEmptyFarmRegistry()
  const skippedAddons = [...candidateResult.skippedAddons]
  const loadedAddons = []
  const seenAddonIds = new Set()
  const seenCropAliases = new Set()
  const seenPetAliases = new Set()
  const seenFoodAliases = new Set()
  const seenChapterIds = new Set()

  for (const candidate of candidateResult.loadedCandidates) {
    const { source, sourceType, manifest } = candidate

    if (!manifest.enabled) {
      skippedAddons.push(makeSkipRecord(source, manifest, 'enabled=false，已跳过'))
      continue
    }

    if (seenAddonIds.has(manifest.id)) {
      skippedAddons.push(makeSkipRecord(source, manifest, `附加件 id ${manifest.id} 重复，已跳过`))
      continue
    }

    let packageError = ''
    const packageCropAliases = new Set()
    const packagePetAliases = new Set()
    const packageFoodAliases = new Set()
    const packageChapterIds = new Set()
    const packageCrops = []
    const packagePets = []
    const packagePetFoods = []

    for (const rawCrop of manifest.crops) {
      const cropResult = validateCropDefinition(rawCrop, source, manifest.schemaVersion)
      if (!cropResult.ok) {
        packageError = cropResult.reason
        break
      }

      if (packageCropAliases.has(cropResult.crop.alias)) {
        packageError = `${source} 内部重复声明了 crop alias ${cropResult.crop.alias}`
        break
      }

      if (seenCropAliases.has(cropResult.crop.alias)) {
        packageError = `${source} 的 crop alias ${cropResult.crop.alias} 与已有附加件冲突`
        break
      }

      packageCropAliases.add(cropResult.crop.alias)
      packageCrops.push(cropResult.crop)
    }

    if (packageError) {
      skippedAddons.push(makeSkipRecord(source, manifest, packageError))
      continue
    }

    for (const rawPet of manifest.pets) {
      const petResult = validatePetDefinition(rawPet, source)
      if (!petResult.ok) {
        packageError = petResult.reason
        break
      }

      if (packagePetAliases.has(petResult.pet.alias)) {
        packageError = `${source} 内部重复声明了 pet alias ${petResult.pet.alias}`
        break
      }

      if (seenPetAliases.has(petResult.pet.alias)) {
        packageError = `${source} 的 pet alias ${petResult.pet.alias} 与已有附加件冲突`
        break
      }

      packagePetAliases.add(petResult.pet.alias)
      packagePets.push(petResult.pet)
    }

    if (packageError) {
      skippedAddons.push(makeSkipRecord(source, manifest, packageError))
      continue
    }

    for (const rawFood of manifest.petFoods) {
      const foodResult = validatePetFoodDefinition(rawFood, source)
      if (!foodResult.ok) {
        packageError = foodResult.reason
        break
      }

      if (packageFoodAliases.has(foodResult.petFood.alias)) {
        packageError = `${source} 内部重复声明了 petFood alias ${foodResult.petFood.alias}`
        break
      }

      if (seenFoodAliases.has(foodResult.petFood.alias)) {
        packageError = `${source} 的 petFood alias ${foodResult.petFood.alias} 与已有附加件冲突`
        break
      }

      packageFoodAliases.add(foodResult.petFood.alias)
      packagePetFoods.push(foodResult.petFood)
    }

    if (packageError) {
      skippedAddons.push(makeSkipRecord(source, manifest, packageError))
      continue
    }

    const availableCropAliases = new Set([...seenCropAliases, ...packageCropAliases])
    const availableFoodAliases = new Set([...seenFoodAliases, ...packageFoodAliases])
    const packageStarterGrants = []
    for (const rawGrant of manifest.starterGrants) {
      const grantResult = validateStarterGrant(rawGrant, source, availableCropAliases)
      if (!grantResult.ok) {
        packageError = grantResult.reason
        break
      }

      packageStarterGrants.push(grantResult.grant)
    }

    if (packageError) {
      skippedAddons.push(makeSkipRecord(source, manifest, packageError))
      continue
    }

    const packageOrderTemplates = []
    for (const rawTemplate of manifest.orderTemplates) {
      const templateResult = validateOrderTemplate(rawTemplate, source)
      if (!templateResult.ok) {
        packageError = templateResult.reason
        break
      }

      const missingRequirement = templateResult.template.requirements.find(requirement => !availableCropAliases.has(requirement.cropAlias))
      if (missingRequirement) {
        skippedAddons.push(makeSkipRecord(source, manifest, `订单模板 ${missingRequirement.cropAlias} 未找到对应 crop，已跳过该模板`))
        continue
      }

      packageOrderTemplates.push(templateResult.template)
    }

    if (packageError) {
      skippedAddons.push(makeSkipRecord(source, manifest, packageError))
      continue
    }

    const packageChapters = []
    for (const rawChapter of manifest.mainQuestChapters) {
      const chapterResult = validateQuestChapter(rawChapter, source, availableCropAliases, availableFoodAliases)
      if (!chapterResult.ok) {
        packageError = chapterResult.reason
        break
      }

      if (packageChapterIds.has(chapterResult.chapter.id)) {
        packageError = `${source} 内部重复声明了 mainQuestChapter id ${chapterResult.chapter.id}`
        break
      }

      if (seenChapterIds.has(chapterResult.chapter.id)) {
        packageError = `${source} 的 mainQuestChapter id ${chapterResult.chapter.id} 与已有附加件冲突`
        break
      }

      packageChapterIds.add(chapterResult.chapter.id)
      packageChapters.push(chapterResult.chapter)
    }

    if (packageError) {
      skippedAddons.push(makeSkipRecord(source, manifest, packageError))
      continue
    }

    for (const crop of packageCrops) {
      registry.crops[crop.alias] = {
        ...crop,
        addonId: manifest.id,
        addonName: manifest.name,
        source
      }
      seenCropAliases.add(crop.alias)
    }

    for (const pet of packagePets) {
      registry.pets[pet.alias] = {
        ...pet,
        addonId: manifest.id,
        addonName: manifest.name,
        source
      }
      seenPetAliases.add(pet.alias)
    }

    for (const food of packagePetFoods) {
      registry.petFoods[food.alias] = {
        ...food,
        addonId: manifest.id,
        addonName: manifest.name,
        source
      }
      seenFoodAliases.add(food.alias)
    }

    for (const chapter of packageChapters) {
      registry.mainQuestChapters[chapter.id] = {
        ...chapter,
        addonId: manifest.id,
        addonName: manifest.name,
        source
      }
      registry.mainQuestChapterList.push(registry.mainQuestChapters[chapter.id])
      seenChapterIds.add(chapter.id)
    }

    registry.starterGrants.push(...packageStarterGrants)
    registry.orderTemplates.push(...packageOrderTemplates.map(template => ({
      ...template,
      addonId: manifest.id,
      addonName: manifest.name
    })))
    registry.addons.push({
      id: manifest.id,
      name: manifest.name,
      version: manifest.version,
      priority: manifest.priority,
      source,
      sourceType
    })
    seenAddonIds.add(manifest.id)
    loadedAddons.push({
      id: manifest.id,
      name: manifest.name,
      version: manifest.version,
      priority: manifest.priority,
      source,
      sourceType
    })
  }

  registry.loadedAt = Date.now()
  registry.cropList = Object.values(registry.crops).sort((left, right) => {
    if (left.unlockLevel !== right.unlockLevel) {
      return left.unlockLevel - right.unlockLevel
    }

    if (left.seedPrice !== right.seedPrice) {
      return left.seedPrice - right.seedPrice
    }

    return left.alias.localeCompare(right.alias, 'en')
  })
  registry.petList = Object.values(registry.pets).sort((left, right) => {
    if (left.price !== right.price) {
      return left.price - right.price
    }

    return left.alias.localeCompare(right.alias, 'en')
  })
  registry.petFoodList = Object.values(registry.petFoods).sort((left, right) => {
    if (left.tier !== right.tier) {
      return left.tier - right.tier
    }

    if (left.price !== right.price) {
      return left.price - right.price
    }

    return left.alias.localeCompare(right.alias, 'en')
  })

  return {
    ok: true,
    registry,
    loadedAddons,
    skippedAddons
  }
}

function reloadFarmRegistry(reason = 'manual') {
  const previousRegistry = farmRegistry
  const now = Date.now()

  farmAddonStatus.lastReloadAt = now
  farmAddonStatus.lastReloadReason = reason

  let buildResult
  try {
    ensureFarmRuntimeDirs()
    buildResult = buildFarmRegistryFromDisk()
  } catch (error) {
    farmAddonStatus.lastReloadError = error?.message || String(error)
    if (!previousRegistry.cropList.length) {
      farmRegistry = createEmptyFarmRegistry()
    }

    return {
      ok: false,
      error: farmAddonStatus.lastReloadError
    }
  }

  if (!buildResult.ok) {
    farmAddonStatus.lastReloadError = buildResult.error
    farmAddonStatus.skippedAddons = buildResult.skippedAddons || farmAddonStatus.skippedAddons
    if (!previousRegistry.cropList.length) {
      farmRegistry = createEmptyFarmRegistry()
    }
    return {
      ok: false,
      error: buildResult.error
    }
  }

  farmRegistry = buildResult.registry
  farmAddonStatus.lastSuccessfulReloadAt = now
  farmAddonStatus.lastReloadError = ''
  farmAddonStatus.reloadCount += 1
  farmAddonStatus.loadedAddons = buildResult.loadedAddons
  farmAddonStatus.skippedAddons = buildResult.skippedAddons
  syncAllFarmStates(now)

  return {
    ok: true,
    registry: farmRegistry
  }
}

function stopFarmWatcher() {
  if (farmWatchTimer) {
    clearTimeout(farmWatchTimer)
    farmWatchTimer = null
  }

  if (farmWatcher) {
    farmWatcher.close()
    farmWatcher = null
  }

  farmAddonStatus.watching = false
}

function startFarmWatcher() {
  stopFarmWatcher()

  if (!farmConfig.watchEnabled) {
    return
  }

  try {
    farmWatcher = fs.watch(farmConfig.addonDirPath, () => {
      if (farmWatchTimer) {
        clearTimeout(farmWatchTimer)
      }

      farmWatchTimer = setTimeout(() => {
        reloadFarmRegistry('watch')
      }, farmConfig.watchDebounceMs)
    })
    farmAddonStatus.watching = true
  } catch (error) {
    farmAddonStatus.watching = false
    farmAddonStatus.lastReloadError = `启动 farm 附加件监听失败: ${error?.message || error}`
  }
}

function addSeedInventory(state, crop, count) {
  const normalizedCount = Math.max(0, normalizeInteger(count, 0))
  if (normalizedCount <= 0) {
    return
  }

  const entry = state.seeds[crop.alias] || {
    cropAlias: crop.alias,
    count: 0,
    nameSnapshot: crop.name,
    seedNameSnapshot: crop.seedName,
    seedPriceSnapshot: crop.seedPrice
  }

  entry.count += normalizedCount
  entry.nameSnapshot = crop.name
  entry.seedNameSnapshot = crop.seedName
  entry.seedPriceSnapshot = crop.seedPrice
  state.seeds[crop.alias] = entry
}

function noteCollectedCropAlias(state, cropAlias) {
  if (!state.stats.collectedCropAliases.includes(cropAlias)) {
    state.stats.collectedCropAliases.push(cropAlias)
  }
}

function addCropInventory(state, payload) {
  const cropAlias = normalizeAlias(payload?.cropAlias)
  const count = Math.max(0, normalizeInteger(payload?.count, 0))
  if (!cropAlias || count <= 0) {
    return
  }

  const entry = state.crops[cropAlias] || {
    cropAlias,
    count: 0,
    nameSnapshot: String(payload?.nameSnapshot || '').trim(),
    sellPriceSnapshot: Math.max(0, normalizeInteger(payload?.sellPriceSnapshot, 0))
  }

  entry.count += count
  entry.nameSnapshot = String(payload?.nameSnapshot || entry.nameSnapshot || '').trim()
  entry.sellPriceSnapshot = Math.max(0, normalizeInteger(payload?.sellPriceSnapshot, entry.sellPriceSnapshot || 0))
  state.crops[cropAlias] = entry
  noteCollectedCropAlias(state, cropAlias)
}

function addPetFoodInventory(state, food, count) {
  const normalizedCount = Math.max(0, normalizeInteger(count, 0))
  if (normalizedCount <= 0) {
    return
  }

  const snapshot = buildPetFoodSnapshot(food)
  if (!snapshot) {
    return
  }

  const entry = state.petFoods[snapshot.alias] || {
    foodAlias: snapshot.alias,
    count: 0,
    nameSnapshot: snapshot.name,
    guardHoursSnapshot: snapshot.guardHours,
    priceSnapshot: snapshot.price,
    tierSnapshot: snapshot.tier,
    xpRewardSnapshot: snapshot.xpReward,
    fatigueRecoverySnapshot: snapshot.fatigueRecovery
  }

  entry.count += normalizedCount
  entry.nameSnapshot = snapshot.name
  entry.guardHoursSnapshot = snapshot.guardHours
  entry.priceSnapshot = snapshot.price
  entry.tierSnapshot = snapshot.tier
  entry.xpRewardSnapshot = snapshot.xpReward
  entry.fatigueRecoverySnapshot = snapshot.fatigueRecovery
  state.petFoods[snapshot.alias] = entry
}

function applyStarterGrants(state) {
  for (const grant of farmRegistry.starterGrants) {
    const crop = getCropByAlias(grant.cropAlias)
    if (!crop) {
      continue
    }

    addSeedInventory(state, crop, grant.seedCount)
    if (grant.cropCount > 0) {
      addCropInventory(state, {
        cropAlias: crop.alias,
        count: grant.cropCount,
        nameSnapshot: crop.name,
        sellPriceSnapshot: crop.sellPrice
      })
    }
  }

  state.starterGrantApplied = true
}

function getAvailableOrderTemplatesForState(state) {
  return farmRegistry.orderTemplates.filter(template => {
    return template.requirements.every(requirement => {
      const crop = getCropByAlias(requirement.cropAlias)
      return isCropUnlockedForState(crop, state)
    })
  })
}

function createOrder(state, expiresAt, slot) {
  const template = rollWeighted(getAvailableOrderTemplatesForState(state))
  if (!template) {
    return null
  }

  const requirements = []
  let coinReward = 0
  let favorReward = 0

  for (const requirement of template.requirements) {
    const crop = getCropByAlias(requirement.cropAlias)
    if (!crop) {
      return null
    }

    const requiredQty = rollInt(requirement.qtyMin, requirement.qtyMax)
    requirements.push({
      cropAlias: crop.alias,
      cropNameSnapshot: crop.name,
      requiredQty
    })
    coinReward += requiredQty * (crop.sellPrice + template.coinBonusPerUnit)
    favorReward += crop.orderFavorReward
  }

  return {
    slot,
    requirements,
    coinReward,
    favorReward,
    expiresAt
  }
}

function refreshOrderBoard(state, now = Date.now()) {
  const expiresAt = now + FARM_ORDER_REFRESH_MS
  const orders = []

  for (let index = 0; index < FARM_ORDER_SLOT_COUNT; index++) {
    const order = createOrder(state, expiresAt, index + 1)
    if (order) {
      orders.push(order)
    }
  }

  state.orderBoardExpiresAt = expiresAt
  state.orders = orders
}

function refillMissingOrders(state) {
  if (!state.orderBoardExpiresAt) {
    return
  }

  const orders = []
  for (let index = 0; index < FARM_ORDER_SLOT_COUNT; index++) {
    const existing = normalizeOrder(state.orders[index], index, state.orderBoardExpiresAt)
    if (existing) {
      orders.push(existing)
      continue
    }

    const created = createOrder(state, state.orderBoardExpiresAt, index + 1)
    if (created) {
      orders.push(created)
    }
  }

  state.orders = orders
}

function cleanupInventoryEntries(state) {
  for (const [alias, entry] of Object.entries(state.seeds)) {
    if (!entry || entry.count <= 0) {
      delete state.seeds[alias]
    }
  }

  for (const [alias, entry] of Object.entries(state.crops)) {
    if (!entry || entry.count <= 0) {
      delete state.crops[alias]
    }
  }

  for (const [alias, entry] of Object.entries(state.petFoods)) {
    if (!entry || entry.count <= 0) {
      delete state.petFoods[alias]
    }
  }
}

function getDailyTaskProgressValue(state, type) {
  switch (type) {
  case 'open_farm':
    return state.dailyStats.openFarmCount
  case 'buy_seed':
    return state.dailyStats.buySeedCount
  case 'plant':
    return state.dailyStats.plantCount
  case 'water':
    return state.dailyStats.waterCount
  case 'harvest':
    return state.dailyStats.harvestUnits
  case 'sell_crop_units':
    return state.dailyStats.sellCropUnits
  case 'deliver_order':
    return state.dailyStats.deliverOrderCount
  default:
    return 0
  }
}

function createDailyTask(template, state) {
  const target = rollInt(template.targetMin, template.targetMax)
  return {
    templateId: template.id,
    type: template.type,
    title: template.title,
    target,
    progress: Math.min(target, getDailyTaskProgressValue(state, template.type)),
    coinReward: template.coinReward,
    xpReward: template.xpReward,
    completedAt: 0
  }
}

function fillDailyTasks(state) {
  let changed = false
  const existingTemplateIds = new Set((state.dailyTasks || []).map(task => task.templateId))

  while (state.dailyTasks.length < FARM_DAILY_TASK_SLOT_COUNT) {
    const availableTemplates = FARM_DAILY_TASK_TEMPLATES.filter(template => !existingTemplateIds.has(template.id))
    const template = rollWeighted(availableTemplates)
    if (!template) {
      break
    }

    state.dailyTasks.push(createDailyTask(template, state))
    existingTemplateIds.add(template.id)
    changed = true
  }

  return changed
}

function syncDailyTasks(state, now = Date.now()) {
  let changed = false
  const dayKey = getFarmDayKey(now)

  if (state.dailyTaskDayKey !== dayKey) {
    state.dailyTaskDayKey = dayKey
    state.dailyStats = createDefaultDailyFarmStats()
    state.dailyTasks = []
    changed = true
  }

  if (fillDailyTasks(state)) {
    changed = true
  }

  for (const task of state.dailyTasks) {
    const progress = Math.min(task.target, getDailyTaskProgressValue(state, task.type))
    if (task.progress !== progress) {
      task.progress = progress
      changed = true
    }
  }

  return changed
}

function resetDailyStealIfNeeded(state, now = Date.now()) {
  const dayKey = getFarmDayKey(now)
  if (state.dailyStealDayKey !== dayKey) {
    state.dailyStealDayKey = dayKey
    state.dailyStealAttempts = 0
    return true
  }

  return false
}

function syncSinglePetLifecycle(state, petEntry, now = Date.now()) {
  if (!petEntry) {
    return false
  }

  const hasLifecycleSyncedAt = Number.isFinite(Number(petEntry.lifecycleSyncedAt))
  const hasBoughtAt = Number.isFinite(Number(petEntry.boughtAt))
  const lastSyncedAt = hasLifecycleSyncedAt
    ? Math.max(0, Number(petEntry.lifecycleSyncedAt))
    : (hasBoughtAt ? Math.max(0, Number(petEntry.boughtAt)) : now)
  if (!hasLifecycleSyncedAt && !hasBoughtAt) {
    petEntry.lifecycleSyncedAt = now
    return true
  }

  if (now <= lastSyncedAt) {
    if (petEntry.lifecycleSyncedAt !== now) {
      petEntry.lifecycleSyncedAt = now
      return true
    }
    return false
  }

  let changed = false
  let cursor = lastSyncedAt
  const isActivePet = state.activePetAlias === petEntry.petAlias

  if (isActivePet && petEntry.guardUntil > cursor) {
    const guardEnd = Math.min(now, petEntry.guardUntil)
    const guardedMs = Math.max(0, guardEnd - cursor)
    if (guardedMs > 0) {
      const totalActiveMs = Math.max(0, normalizeInteger(petEntry.activeProgressMs, 0)) + guardedMs
      const activeHours = Math.floor(totalActiveMs / HOUR_MS)
      const activeRemainderMs = totalActiveMs % HOUR_MS
      if (petEntry.activeProgressMs !== activeRemainderMs) {
        petEntry.activeProgressMs = activeRemainderMs
        changed = true
      }
      if (activeHours > 0) {
        const nextFatigue = clamp(
          normalizeInteger(petEntry.fatigue, 0) + (activeHours * Math.max(0, normalizeInteger(petEntry.fatigueGainPerHourSnapshot, FARM_PET_DEFAULT_FATIGUE_GAIN_PER_HOUR))),
          0,
          100
        )
        if (petEntry.fatigue !== nextFatigue) {
          petEntry.fatigue = nextFatigue
          changed = true
        }
        const xpResult = gainPetXp(petEntry, activeHours)
        if (xpResult.xpGained > 0 || xpResult.levelAfter !== xpResult.levelBefore) {
          changed = true
        }
      }
      cursor = guardEnd
    }
  }

  const restMs = Math.max(0, now - cursor)
  if (restMs > 0) {
    const totalRestMs = Math.max(0, normalizeInteger(petEntry.restProgressMs, 0)) + restMs
    const restHours = Math.floor(totalRestMs / HOUR_MS)
    const restRemainderMs = totalRestMs % HOUR_MS
    if (petEntry.restProgressMs !== restRemainderMs) {
      petEntry.restProgressMs = restRemainderMs
      changed = true
    }
    if (restHours > 0) {
      const nextFatigue = clamp(
        normalizeInteger(petEntry.fatigue, 0) - (restHours * FARM_PET_FATIGUE_RECOVERY_PER_HOUR),
        0,
        100
      )
      if (petEntry.fatigue !== nextFatigue) {
        petEntry.fatigue = nextFatigue
        changed = true
      }
    }
  }

  if (petEntry.lifecycleSyncedAt !== now) {
    petEntry.lifecycleSyncedAt = now
    changed = true
  }

  syncPetLevel(petEntry)
  return changed
}

function syncPetLifecycles(state, now = Date.now()) {
  let changed = false
  for (const petEntry of Object.values(state.pets || {})) {
    if (syncSinglePetLifecycle(state, petEntry, now)) {
      changed = true
    }
  }
  return changed
}

function syncGuardProgress(state, now = Date.now()) {
  const activePet = getActivePetEntry(state)
  const trackedAt = Number.isFinite(Number(state.guardTrackedAt))
    ? Math.max(0, Number(state.guardTrackedAt))
    : now
  let changed = false

  if (activePet && activePet.guardUntil > trackedAt) {
    const end = Math.min(now, activePet.guardUntil)
    if (end > trackedAt) {
      state.stats.guardAccumulatedMs += end - trackedAt
      changed = true
    }
  }

  if (state.guardTrackedAt !== now) {
    state.guardTrackedAt = now
    changed = true
  }

  if (syncPetLifecycles(state, now)) {
    changed = true
  }

  return changed
}

function ensureQuestStates(state, options = {}, now = Date.now()) {
  let changed = false

  for (const chapter of farmRegistry.mainQuestChapterList) {
    if (!state.mainQuests[chapter.id]) {
      state.mainQuests[chapter.id] = {
        chapterId: chapter.id,
        currentStep: 0,
        progress: 0,
        completedAt: 0
      }
      changed = true
    }

    const questState = state.mainQuests[chapter.id]
    const maxStep = chapter.steps.length
    if (questState.completedAt && questState.currentStep < maxStep) {
      questState.currentStep = maxStep
      changed = true
    }
    if (questState.currentStep > maxStep) {
      questState.currentStep = maxStep
      changed = true
    }

    if (options.completeTutorial && chapter.id === 'tutorial' && !questState.completedAt) {
      questState.currentStep = maxStep
      questState.progress = chapter.steps[maxStep - 1]?.target || 0
      questState.completedAt = now
      changed = true
    }
  }

  return changed
}

function isQuestChapterCompleted(chapter, questState) {
  if (!chapter) {
    return false
  }

  const maxStep = chapter.steps.length
  return Boolean(questState?.completedAt) || (Number(questState?.currentStep) || 0) >= maxStep
}

function getVisibleQuestChapters(state) {
  const visible = []

  for (const chapter of farmRegistry.mainQuestChapterList) {
    visible.push(chapter)
    const questState = state.mainQuests?.[chapter.id]
    if (!isQuestChapterCompleted(chapter, questState)) {
      break
    }
  }

  return visible
}

function syncFarmState(state, now = Date.now()) {
  ensureFarmReady()

  let changed = false
  const serializedBefore = JSON.stringify(state)
  const normalized = sanitizeFarmState(state, { legacyFarm: hasLegacyFarmProgress(state) })

  if (serializedBefore !== JSON.stringify(normalized)) {
    for (const key of Object.keys(state)) {
      if (!(key in normalized)) {
        delete state[key]
      }
    }
    Object.assign(state, normalized)
    changed = true
  }

  if (!state.starterGrantApplied) {
    applyStarterGrants(state)
    changed = true
  }

  if (resetDailyStealIfNeeded(state, now)) {
    changed = true
  }

  if (syncGuardProgress(state, now)) {
    changed = true
  }

  if (ensureQuestStates(state, { completeTutorial: hasLegacyFarmProgress(state) }, now)) {
    changed = true
  }

  if (syncDailyTasks(state, now)) {
    changed = true
  }

  if (!state.orderBoardExpiresAt || state.orderBoardExpiresAt <= now) {
    refreshOrderBoard(state, now)
    changed = true
  } else {
    const beforeCount = state.orders.length
    refillMissingOrders(state)
    if (state.orders.length !== beforeCount) {
      changed = true
    }
  }

  cleanupInventoryEntries(state)
  ensureFarmLevelConsistency(state)

  if (changed) {
    touchFarmState(state)
    void flushFarmData()
  }

  return state
}

function ensureFarmState(userId) {
  ensureFarmReady()
  assertFarmPersistenceReady()

  const normalizedUserId = normalizeUserId(userId)
  if (!farmStates.has(normalizedUserId)) {
    const state = createDefaultFarmState()
    farmStates.set(normalizedUserId, state)
    syncFarmState(state)
    saveFarmData()
  }

  const state = farmStates.get(normalizedUserId)
  syncFarmState(state)
  return state
}

function getQuestStepProgress(state, step, now = Date.now()) {
  switch (step.type) {
  case 'open_farm':
    return state.stats.openFarmCount
  case 'buy_seed':
    return state.stats.buySeedCount
  case 'plant':
    return state.stats.plantCount
  case 'water':
    return state.stats.waterCount
  case 'harvest':
    return state.stats.harvestUnits
  case 'sell_crop_units':
    return state.stats.sellCropUnits
  case 'deliver_order':
    return state.stats.deliverOrderCount
  case 'reach_level':
    return state.farmLevel
  case 'buy_plot':
    if (step.plotId) {
      return getPlotById(state, step.plotId)?.owned ? 1 : 0
    }
    if (step.landType) {
      return state.plots.filter(plot => plot.owned && plot.landType === step.landType).length
    }
    return state.stats.buyPlotCount
  case 'harvest_on_land':
    return Math.max(0, normalizeInteger(state.stats.harvestOnLand?.[step.landType] || 0, 0))
  case 'collect_crop_kinds':
    return state.stats.collectedCropAliases.length
  case 'buy_pet':
    return Object.keys(state.pets).length
  case 'buy_pet_food':
    return state.stats.buyPetFoodCount
  case 'feed_pet_hours':
    return Math.floor(state.stats.feedPetAddedMs / HOUR_MS)
  case 'visit_farm':
    return state.stats.visitFarmCount
  case 'attempt_steal':
    return state.stats.attemptStealCount
  case 'successful_steal':
    return state.stats.successfulStealCount
  case 'accumulate_guard_hours':
    return Math.floor(state.stats.guardAccumulatedMs / HOUR_MS)
  default:
    return 0
  }
}

function applyQuestReward(state, reward) {
  const summary = {
    coinReward: 0,
    xpGained: 0,
    seedRewards: [],
    petFoodRewards: []
  }

  if (!reward) {
    return summary
  }

  if (reward.coins > 0) {
    summary.coinReward += reward.coins
  }

  let xpReward = Math.max(0, normalizeInteger(reward.xp, 0))
  if (reward.fillToLevel > 0) {
    const requiredXp = getLevelStartXp(reward.fillToLevel)
    if (state.farmXp < requiredXp) {
      xpReward += requiredXp - state.farmXp
    }
  }

  if (xpReward > 0) {
    summary.xpGained = gainFarmXp(state, xpReward).xpGained
  }

  for (const seedReward of reward.seeds || []) {
    const crop = getCropByAlias(seedReward.cropAlias)
    if (!crop) {
      continue
    }

    addSeedInventory(state, crop, seedReward.count)
    summary.seedRewards.push({
      cropAlias: crop.alias,
      seedName: crop.seedName,
      count: seedReward.count
    })
  }

  for (const foodReward of reward.petFoods || []) {
    const food = getPetFoodByAlias(foodReward.foodAlias)
    if (!food) {
      continue
    }

    addPetFoodInventory(state, food, foodReward.count)
    summary.petFoodRewards.push({
      foodAlias: food.alias,
      name: food.name,
      count: foodReward.count
    })
  }

  return summary
}

function createEmptyQuestProgressSummary() {
  return {
    changed: false,
    coinReward: 0,
    xpGained: 0,
    stepCompletions: [],
    chapterCompletions: []
  }
}

function createEmptyDailyTaskProgressSummary() {
  return {
    changed: false,
    coinReward: 0,
    xpGained: 0,
    taskCompletions: []
  }
}

function progressMainQuests(state, now = Date.now()) {
  let changed = false
  let coinReward = 0
  let xpGained = 0
  const stepCompletions = []
  const chapterCompletions = []

  for (const chapter of farmRegistry.mainQuestChapterList) {
    const questState = state.mainQuests[chapter.id] || {
      chapterId: chapter.id,
      currentStep: 0,
      progress: 0,
      completedAt: 0
    }
    state.mainQuests[chapter.id] = questState

    const maxStep = chapter.steps.length
    while (questState.currentStep < maxStep) {
      const step = chapter.steps[questState.currentStep]
      const progressValue = Math.min(step.target, getQuestStepProgress(state, step, now))
      if (questState.progress !== progressValue) {
        questState.progress = progressValue
        changed = true
      }

      if (progressValue < step.target) {
        break
      }

      const rewardSummary = applyQuestReward(state, step.reward)
      coinReward += rewardSummary.coinReward
      xpGained += rewardSummary.xpGained
      questState.currentStep += 1
      questState.progress = 0
      changed = true
      stepCompletions.push({
        chapterId: chapter.id,
        chapterName: chapter.name,
        stepIndex: questState.currentStep,
        totalSteps: maxStep,
        step,
        reward: rewardSummary
      })

      if (questState.currentStep >= maxStep) {
        questState.completedAt = questState.completedAt || now
        chapterCompletions.push({
          chapterId: chapter.id,
          chapterName: chapter.name
        })
      }
    }

    if (questState.currentStep < maxStep) {
      const currentStep = chapter.steps[questState.currentStep]
      const progressValue = Math.min(currentStep.target, getQuestStepProgress(state, currentStep, now))
      if (questState.progress !== progressValue) {
        questState.progress = progressValue
        changed = true
      }
    }

    if (!isQuestChapterCompleted(chapter, questState)) {
      break
    }
  }

  return {
    changed,
    coinReward,
    xpGained,
    stepCompletions,
    chapterCompletions
  }
}

function progressDailyTasks(state, now = Date.now()) {
  let changed = false
  let coinReward = 0
  let xpGained = 0
  const taskCompletions = []

  for (const task of state.dailyTasks) {
    const progress = Math.min(task.target, getDailyTaskProgressValue(state, task.type))
    if (task.progress !== progress) {
      task.progress = progress
      changed = true
    }

    if (task.completedAt || progress < task.target) {
      continue
    }

    task.completedAt = now
    changed = true
    const xpSummary = task.xpReward > 0 ? gainFarmXp(state, task.xpReward) : { xpGained: 0 }
    coinReward += task.coinReward
    xpGained += xpSummary.xpGained
    taskCompletions.push({
      templateId: task.templateId,
      type: task.type,
      title: task.title,
      target: task.target,
      reward: {
        coinReward: task.coinReward,
        xpGained: xpSummary.xpGained
      }
    })
  }

  return {
    changed,
    coinReward,
    xpGained,
    taskCompletions
  }
}

function progressFarmMilestones(state, now = Date.now()) {
  const dailySummary = progressDailyTasks(state, now)
  const questSummary = progressMainQuests(state, now)

  return {
    changed: dailySummary.changed || questSummary.changed,
    dailySummary,
    questSummary
  }
}

function normalizeProgressSummary(summary) {
  if (summary && typeof summary === 'object' && ('questSummary' in summary || 'dailySummary' in summary)) {
    return {
      questSummary: summary.questSummary || createEmptyQuestProgressSummary(),
      dailySummary: summary.dailySummary || createEmptyDailyTaskProgressSummary()
    }
  }

  return {
    questSummary: summary || createEmptyQuestProgressSummary(),
    dailySummary: createEmptyDailyTaskProgressSummary()
  }
}

function buildMutationMeta(state, beforeXp, beforeLevel, progressSummary) {
  const summary = normalizeProgressSummary(progressSummary)
  return {
    farmXpGained: Math.max(0, state.farmXp - beforeXp),
    levelBefore: beforeLevel,
    levelAfter: state.farmLevel,
    questCoinReward: summary.questSummary.coinReward,
    dailyCoinReward: summary.dailySummary.coinReward,
    questProgress: {
      stepCompletions: summary.questSummary.stepCompletions,
      chapterCompletions: summary.questSummary.chapterCompletions
    },
    dailyProgress: {
      taskCompletions: summary.dailySummary.taskCompletions
    }
  }
}

function updateFarmProgress(state, now = Date.now()) {
  syncFarmState(state, now)
  const beforeXp = state.farmXp
  const beforeLevel = state.farmLevel
  const progressSummary = progressFarmMilestones(state, now)
  if (progressSummary.changed) {
    touchFarmState(state)
  }

  return {
    ok: true,
    ...buildMutationMeta(state, beforeXp, beforeLevel, progressSummary)
  }
}

function recordFarmAction(state, action, now = Date.now()) {
  syncFarmState(state, now)
  const beforeXp = state.farmXp
  const beforeLevel = state.farmLevel
  let changed = false

  if (action === 'open_farm') {
    state.stats.openFarmCount += 1
    state.dailyStats.openFarmCount += 1
    changed = true
  }

  const progressSummary = progressFarmMilestones(state, now)
  if (changed || progressSummary.changed) {
    touchFarmState(state)
  }

  return {
    ok: true,
    ...buildMutationMeta(state, beforeXp, beforeLevel, progressSummary)
  }
}

function getPlotWaterCost(plot) {
  const crop = getCropByAlias(plot.cropAlias)
  return crop?.waterStamina ?? plot.waterStaminaSnapshot ?? 0
}

function buildPetViewEntry(entry, now = Date.now()) {
  if (!entry) {
    return null
  }

  const cloned = cloneData(entry)
  const levelInfo = getPetLevelProgressInfo(cloned.xp)
  return {
    ...cloned,
    level: levelInfo.level,
    xp: levelInfo.totalXp,
    levelXp: levelInfo.currentXp,
    levelXpNeeded: levelInfo.neededXp,
    nextLevel: levelInfo.nextLevel,
    isMaxLevel: levelInfo.isMaxLevel,
    fatigue: clamp(normalizeInteger(cloned.fatigue, 0), 0, 100),
    effectiveInterceptPercent: getPetEffectiveInterceptPercent(cloned),
    remainingGuardMs: Math.max(0, cloned.guardUntil - now)
  }
}

function buildPetFoodViewEntry(entry) {
  if (!entry) {
    return null
  }

  const cloned = cloneData(entry)
  return {
    ...cloned,
    tierSnapshot: Math.max(1, normalizeInteger(cloned.tierSnapshot, FARM_PET_DEFAULT_FOOD_TIER)),
    xpRewardSnapshot: Math.max(0, normalizeInteger(cloned.xpRewardSnapshot, cloned.guardHoursSnapshot)),
    fatigueRecoverySnapshot: Math.max(0, normalizeInteger(cloned.fatigueRecoverySnapshot, cloned.guardHoursSnapshot * 3))
  }
}

function getPlotWaterReductionMs(plot) {
  const crop = getCropByAlias(plot.cropAlias)
  const growMinutes = crop?.growMinutes ?? plot.growMinutesSnapshot ?? 0
  const reductionPercent = crop?.waterBaseReductionPercent ?? plot.waterBaseReductionPercentSnapshot ?? 0
  return Math.floor(growMinutes * 60 * 1000 * (reductionPercent / 100))
}

function previewBuySeeds(state, seedAlias, count) {
  syncFarmState(state)

  const normalizedAlias = normalizeAlias(seedAlias)
  const normalizedCount = normalizeCount(count)
  if (!isPositiveInteger(normalizedCount)) {
    return { ok: false, reason: 'invalid_count' }
  }

  const crop = getCropByAlias(normalizedAlias)
  if (!crop) {
    return { ok: false, reason: 'unknown_crop' }
  }

  if (!isCropUnlockedForState(crop, state)) {
    return { ok: false, reason: 'crop_locked', crop }
  }

  return {
    ok: true,
    crop,
    count: normalizedCount,
    totalCost: crop.seedPrice * normalizedCount
  }
}

function buySeeds(state, seedAlias, count, options = {}) {
  const preview = previewBuySeeds(state, seedAlias, count)
  if (!preview.ok || options.preview) {
    return preview
  }

  const now = Date.now()
  const beforeXp = state.farmXp
  const beforeLevel = state.farmLevel

  addSeedInventory(state, preview.crop, preview.count)
  state.stats.buySeedCount += preview.count
  state.dailyStats.buySeedCount += preview.count

  const progressSummary = progressFarmMilestones(state, now)
  touchFarmState(state)

  return {
    ok: true,
    crop: preview.crop,
    count: preview.count,
    totalCost: preview.totalCost,
    inventoryCount: state.seeds[preview.crop.alias].count,
    ...buildMutationMeta(state, beforeXp, beforeLevel, progressSummary)
  }
}

function previewPlantSeed(state, plotId, seedAlias, now = Date.now()) {
  syncFarmState(state, now)

  const selection = parseFarmPlotTarget(state, plotId)
  if (!selection.ok) {
    return selection
  }

  const crop = getCropByAlias(seedAlias)
  if (!crop) {
    return { ok: false, reason: 'unknown_crop' }
  }

  if (!isCropUnlockedForState(crop, state)) {
    return { ok: false, reason: 'crop_locked', crop }
  }

  const previews = []
  for (const plot of selection.plots) {
    if (!plot.owned) {
      return { ok: false, reason: 'plot_locked', plot }
    }

    if (!isPlotEmpty(plot)) {
      return { ok: false, reason: 'plot_occupied', plot }
    }

    const land = getLandConfig(plot.plotId)
    const growMinutes = crop.growMinutes * (land?.growMultiplier || 1)
    previews.push({
      plot,
      readyAt: now + Math.ceil(growMinutes * 60 * 1000),
      growMinutes,
      yieldTotal: Math.max(0, Math.ceil(crop.harvestYield * (land?.yieldMultiplier || 1)))
    })
  }

  const seedEntry = getSeedEntry(state, crop.alias)
  if (!seedEntry || seedEntry.count < previews.length) {
    return {
      ok: false,
      reason: 'seed_missing',
      crop,
      availableSeeds: seedEntry?.count || 0,
      requiredSeeds: previews.length
    }
  }

  return {
    ok: true,
    crop,
    plot: previews[0].plot,
    plots: previews,
    plotTarget: selection.plotTarget,
    staminaCost: crop.plantStamina * previews.length,
    readyAt: previews[0].readyAt,
    growMinutes: previews[0].growMinutes,
    yieldTotal: previews[0].yieldTotal,
    plantCount: previews.length
  }
}

function plantSeed(state, plotId, seedAlias, now = Date.now(), options = {}) {
  const preview = previewPlantSeed(state, plotId, seedAlias, now)
  if (!preview.ok || options.preview) {
    return preview
  }

  const beforeXp = state.farmXp
  const beforeLevel = state.farmLevel
  const seedEntry = getSeedEntry(state, preview.crop.alias)
  seedEntry.count -= preview.plantCount
  if (seedEntry.count <= 0) {
    delete state.seeds[preview.crop.alias]
  }

  for (const plotPreview of preview.plots) {
    Object.assign(plotPreview.plot, {
      cropAlias: preview.crop.alias,
      nameSnapshot: preview.crop.name,
      sellPriceSnapshot: preview.crop.sellPrice,
      yieldTotalSnapshot: plotPreview.yieldTotal,
      yieldStolen: 0,
      growMinutesSnapshot: plotPreview.growMinutes,
      waterStaminaSnapshot: preview.crop.waterStamina,
      waterBaseReductionPercentSnapshot: preview.crop.waterBaseReductionPercent,
      plantedAt: now,
      readyAt: plotPreview.readyAt,
      watered: false
    })
  }
  state.stats.plantCount += preview.plantCount
  state.dailyStats.plantCount += preview.plantCount

  const progressSummary = progressFarmMilestones(state, now)
  touchFarmState(state)

  return {
    ok: true,
    crop: preview.crop,
    plot: preview.plot,
    plots: preview.plots.map(item => item.plot),
    plantCount: preview.plantCount,
    plotTarget: preview.plotTarget,
    staminaCost: preview.staminaCost,
    readyAt: preview.readyAt,
    ...buildMutationMeta(state, beforeXp, beforeLevel, progressSummary)
  }
}

function previewWaterPlots(state, target, now = Date.now()) {
  syncFarmState(state, now)

  const selection = parseFarmPlotTarget(state, target, { allowAll: true })
  if (!selection.ok) {
    return selection
  }

  const selectedPlots = selection.isAll
    ? selection.plots.filter(plot => plot.owned && !isPlotEmpty(plot))
    : selection.plots

  if (selection.isAll && !selectedPlots.length) {
    return { ok: false, reason: 'no_eligible_plots' }
  }

  if (!selection.isAll && selectedPlots.length === 1) {
    const plot = selectedPlots[0]
    if (!plot.owned) {
      return { ok: false, reason: 'plot_locked', plot }
    }
    if (isPlotEmpty(plot)) {
      return { ok: false, reason: 'plot_empty', plot }
    }
    if (isPlotReady(plot, now)) {
      return { ok: false, reason: 'already_ready', plot }
    }
    if (plot.watered) {
      return { ok: false, reason: 'already_watered', plot }
    }
  }

  const eligiblePlots = selectedPlots.filter(plot =>
    plot && plot.owned && !isPlotEmpty(plot) && !isPlotReady(plot, now) && !plot.watered
  )

  if (!eligiblePlots.length) {
    return { ok: false, reason: 'no_eligible_plots' }
  }

  return {
    ok: true,
    plots: eligiblePlots,
    staminaCost: eligiblePlots.reduce((sum, plot) => sum + getPlotWaterCost(plot), 0)
  }
}

function waterPlots(state, target, now = Date.now(), options = {}) {
  const preview = previewWaterPlots(state, target, now)
  if (!preview.ok || options.preview) {
    return preview
  }

  const beforeXp = state.farmXp
  const beforeLevel = state.farmLevel
  const wateredPlots = []
  for (const plot of preview.plots) {
    plot.readyAt = Math.max(now, plot.readyAt - getPlotWaterReductionMs(plot))
    plot.watered = true
    wateredPlots.push({
      plotId: plot.plotId,
      cropAlias: plot.cropAlias,
      nameSnapshot: plot.nameSnapshot,
      readyAt: plot.readyAt
    })
  }

  state.stats.waterCount += wateredPlots.length
  state.dailyStats.waterCount += wateredPlots.length
  const progressSummary = progressFarmMilestones(state, now)
  touchFarmState(state)

  return {
    ok: true,
    plots: wateredPlots,
    staminaCost: preview.staminaCost,
    ...buildMutationMeta(state, beforeXp, beforeLevel, progressSummary)
  }
}

function previewHarvestPlots(state, target, now = Date.now()) {
  syncFarmState(state, now)

  const selection = parseFarmPlotTarget(state, target, { allowAll: true })
  if (!selection.ok) {
    return selection
  }

  const selectedPlots = selection.isAll
    ? selection.plots.filter(plot => plot.owned && !isPlotEmpty(plot))
    : selection.plots

  if (selection.isAll && !selectedPlots.length) {
    return { ok: false, reason: 'no_ready_plots' }
  }

  if (!selection.isAll && selectedPlots.length === 1) {
    const plot = selectedPlots[0]
    if (!plot.owned) {
      return { ok: false, reason: 'plot_locked', plot }
    }
    if (isPlotEmpty(plot)) {
      return { ok: false, reason: 'plot_empty', plot }
    }
    if (!isPlotReady(plot, now)) {
      return { ok: false, reason: 'not_ready', plot }
    }
  }

  const readyPlots = selectedPlots.filter(plot => plot && plot.owned && isPlotReady(plot, now))
  if (!readyPlots.length) {
    return { ok: false, reason: 'no_ready_plots' }
  }

  return {
    ok: true,
    plots: readyPlots
  }
}

function harvestPlots(state, target, now = Date.now()) {
  const preview = previewHarvestPlots(state, target, now)
  if (!preview.ok) {
    return preview
  }

  const beforeXp = state.farmXp
  const beforeLevel = state.farmLevel
  const harvested = []
  let totalUnits = 0

  for (const plot of preview.plots) {
    const count = Math.max(0, normalizeInteger(plot.yieldTotalSnapshot, 0) - normalizeInteger(plot.yieldStolen, 0))
    if (count > 0) {
      addCropInventory(state, {
        cropAlias: plot.cropAlias,
        count,
        nameSnapshot: plot.nameSnapshot,
        sellPriceSnapshot: plot.sellPriceSnapshot
      })
      state.stats.harvestUnits += count
      state.dailyStats.harvestUnits += count
      state.stats.harvestOnLand[plot.landType] += count
      totalUnits += count
    }

    harvested.push({
      plotId: plot.plotId,
      cropAlias: plot.cropAlias,
      nameSnapshot: plot.nameSnapshot,
      count
    })

    Object.assign(plot, createEmptyPlot(plot.plotId), {
      owned: plot.owned
    })
  }

  if (totalUnits > 0) {
    gainFarmXp(state, totalUnits * 2)
  }

  const progressSummary = progressFarmMilestones(state, now)
  touchFarmState(state)

  return {
    ok: true,
    harvested,
    ...buildMutationMeta(state, beforeXp, beforeLevel, progressSummary)
  }
}

function sellCrops(state, cropAlias, count) {
  syncFarmState(state)
  const now = Date.now()
  const beforeXp = state.farmXp
  const beforeLevel = state.farmLevel
  const normalizedAlias = normalizeAlias(cropAlias)
  const cropEntry = getCropEntry(state, normalizedAlias)
  if (!cropEntry || cropEntry.count <= 0) {
    return { ok: false, reason: 'inventory_missing' }
  }

  const normalizedCount = String(count).trim().toLowerCase() === 'all'
    ? cropEntry.count
    : normalizeCount(count)
  if (!isPositiveInteger(normalizedCount)) {
    return { ok: false, reason: 'invalid_count' }
  }

  if (cropEntry.count < normalizedCount) {
    return {
      ok: false,
      reason: 'insufficient_inventory',
      available: cropEntry.count
    }
  }

  cropEntry.count -= normalizedCount
  if (cropEntry.count <= 0) {
    delete state.crops[normalizedAlias]
  }

  const coinReward = normalizedCount * cropEntry.sellPriceSnapshot
  state.stats.sellCropUnits += normalizedCount
  state.dailyStats.sellCropUnits += normalizedCount
  if (coinReward > 0) {
    gainFarmXp(state, Math.floor(coinReward / 10))
  }

  const progressSummary = progressFarmMilestones(state, now)
  touchFarmState(state)

  return {
    ok: true,
    cropAlias: normalizedAlias,
    cropNameSnapshot: cropEntry.nameSnapshot,
    soldCount: normalizedCount,
    coinReward,
    ...buildMutationMeta(state, beforeXp, beforeLevel, progressSummary)
  }
}

function sellSeeds(state, seedAlias, count) {
  syncFarmState(state)
  const normalizedAlias = normalizeAlias(seedAlias)
  const seedEntry = getSeedEntry(state, normalizedAlias)
  if (!seedEntry || seedEntry.count <= 0) {
    return { ok: false, reason: 'inventory_missing' }
  }

  const normalizedCount = String(count).trim().toLowerCase() === 'all'
    ? seedEntry.count
    : normalizeCount(count)
  if (!isPositiveInteger(normalizedCount)) {
    return { ok: false, reason: 'invalid_count' }
  }

  if (seedEntry.count < normalizedCount) {
    return {
      ok: false,
      reason: 'insufficient_inventory',
      available: seedEntry.count
    }
  }

  seedEntry.count -= normalizedCount
  if (seedEntry.count <= 0) {
    delete state.seeds[normalizedAlias]
  }

  const resalePrice = getSeedSellPrice(seedEntry.seedPriceSnapshot)
  const coinReward = normalizedCount * resalePrice
  touchFarmState(state)

  return {
    ok: true,
    cropAlias: normalizedAlias,
    seedNameSnapshot: seedEntry.seedNameSnapshot || `${seedEntry.nameSnapshot}种子`,
    soldCount: normalizedCount,
    resalePrice,
    coinReward
  }
}

function replaceOrderSlot(state, slotIndex, now = Date.now()) {
  if (!state.orderBoardExpiresAt || state.orderBoardExpiresAt <= now) {
    refreshOrderBoard(state, now)
    return
  }

  const replacement = createOrder(state, state.orderBoardExpiresAt, slotIndex + 1)
  if (replacement) {
    state.orders[slotIndex] = replacement
  } else {
    state.orders.splice(slotIndex, 1)
  }
}

function deliverOrder(state, orderIndex, now = Date.now()) {
  syncFarmState(state, now)
  const beforeXp = state.farmXp
  const beforeLevel = state.farmLevel
  const slotIndex = Number(orderIndex) - 1
  if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= state.orders.length) {
    return { ok: false, reason: 'order_missing' }
  }

  const order = state.orders[slotIndex]
  if (!order) {
    return { ok: false, reason: 'order_missing' }
  }

  const missingRequirements = order.requirements.reduce((list, requirement) => {
    const cropEntry = getCropEntry(state, requirement.cropAlias)
    const available = cropEntry?.count || 0
    if (available < requirement.requiredQty) {
      list.push({
        ...requirement,
        available,
        required: requirement.requiredQty
      })
    }
    return list
  }, [])
  if (missingRequirements.length) {
    return {
      ok: false,
      reason: 'insufficient_inventory',
      missingRequirements,
      order
    }
  }

  for (const requirement of order.requirements) {
    const cropEntry = getCropEntry(state, requirement.cropAlias)
    cropEntry.count -= requirement.requiredQty
    if (cropEntry.count <= 0) {
      delete state.crops[requirement.cropAlias]
    }
  }

  const completedOrder = cloneData(order)
  replaceOrderSlot(state, slotIndex, now)
  state.stats.deliverOrderCount += 1
  state.dailyStats.deliverOrderCount += 1
  const totalRequiredQty = completedOrder.requirements.reduce((sum, requirement) => sum + requirement.requiredQty, 0)
  gainFarmXp(state, 10 + (totalRequiredQty * 3))

  const progressSummary = progressFarmMilestones(state, now)
  touchFarmState(state)

  return {
    ok: true,
    order: completedOrder,
    replacement: state.orders[slotIndex] || null,
    coinReward: completedOrder.coinReward,
    favorReward: completedOrder.favorReward,
    ...buildMutationMeta(state, beforeXp, beforeLevel, progressSummary)
  }
}

function getFarmLevelInfo(state) {
  syncFarmState(state)
  const levelInfo = getFarmLevelProgressInfo(state.farmXp)
  return {
    level: state.farmLevel,
    totalXp: state.farmXp,
    currentXp: levelInfo.currentXp,
    neededXp: levelInfo.neededXp,
    nextLevel: state.farmLevel + 1
  }
}

function getUnlockedFarmCrops(state) {
  syncFarmState(state)
  return cloneData(farmRegistry.cropList.filter(crop => isCropUnlockedForState(crop, state)))
}

function getFarmQuestView(state, now = Date.now()) {
  syncFarmState(state, now)

  return getVisibleQuestChapters(state).map(chapter => {
    const questState = state.mainQuests[chapter.id] || {
      chapterId: chapter.id,
      currentStep: 0,
      progress: 0,
      completedAt: 0
    }
    const completed = questState.currentStep >= chapter.steps.length
    const currentStepIndex = completed ? chapter.steps.length - 1 : questState.currentStep
    const currentStep = chapter.steps[currentStepIndex] || null
    const progress = completed
      ? currentStep?.target || 0
      : currentStep
        ? Math.min(currentStep.target, getQuestStepProgress(state, currentStep, now))
        : 0

    return {
      chapterId: chapter.id,
      name: chapter.name,
      description: chapter.description,
      totalSteps: chapter.steps.length,
      currentStep: completed ? chapter.steps.length : (questState.currentStep + 1),
      completed,
      completedAt: questState.completedAt || 0,
      progress,
      target: currentStep?.target || 0,
      step: currentStep,
      steps: chapter.steps
    }
  })
}

function getFarmDailyTaskView(state, now = Date.now()) {
  syncFarmState(state, now)
  const dayKey = state.dailyTaskDayKey || getFarmDayKey(now)

  return {
    dayKey,
    resetsAt: dayKey + DAY_MS,
    completedCount: state.dailyTasks.filter(task => task.completedAt > 0).length,
    totalCount: state.dailyTasks.length,
    tasks: state.dailyTasks.map(task => ({
      ...cloneData(task),
      progress: Math.min(task.target, getDailyTaskProgressValue(state, task.type)),
      completed: task.completedAt > 0
    }))
  }
}

function getFarmLandView(state) {
  syncFarmState(state)

  return LAND_CONFIG.map(land => {
    const plot = getPlotById(state, land.plotId)
    return {
      ...land,
      owned: Boolean(plot?.owned),
      cropAlias: plot?.cropAlias || '',
      nameSnapshot: plot?.nameSnapshot || '',
      readyAt: plot?.readyAt || 0,
      yieldTotalSnapshot: plot?.yieldTotalSnapshot || 0,
      yieldStolen: plot?.yieldStolen || 0,
      watered: Boolean(plot?.watered)
    }
  })
}

function buyPlot(state, plotId, options = {}) {
  syncFarmState(state, options.now ?? Date.now())
  const land = getLandConfig(plotId)
  if (!land) {
    return { ok: false, reason: 'plot_out_of_range' }
  }

  const plot = getPlotById(state, plotId)
  if (plot?.owned) {
    return { ok: false, reason: 'plot_already_owned', plot, land }
  }

  if (state.farmLevel < land.unlockLevel) {
    return { ok: false, reason: 'plot_locked_by_level', plot, land }
  }

  if (options.preview) {
    return {
      ok: true,
      plot,
      land,
      price: land.price
    }
  }

  const now = options.now ?? Date.now()
  const beforeXp = state.farmXp
  const beforeLevel = state.farmLevel
  plot.owned = true
  state.stats.buyPlotCount += 1
  if (!state.stats.boughtPlotIds.includes(plot.plotId)) {
    state.stats.boughtPlotIds.push(plot.plotId)
  }

  const questSummary = progressMainQuests(state, now)
  touchFarmState(state)

  return {
    ok: true,
    plot,
    land,
    price: land.price,
    ...buildMutationMeta(state, beforeXp, beforeLevel, questSummary)
  }
}

function getFarmPetView(state, now = Date.now()) {
  syncFarmState(state, now)
  const activePet = getActivePetEntry(state)

  return {
    unlocked: isFarmSocialUnlocked(state),
    activePetAlias: state.activePetAlias,
    activePet: buildPetViewEntry(activePet, now),
    pets: Object.values(state.pets)
      .sort((left, right) => left.petAlias.localeCompare(right.petAlias, 'en'))
      .map(entry => buildPetViewEntry(entry, now)),
    petFoods: Object.values(state.petFoods)
      .sort((left, right) => left.foodAlias.localeCompare(right.foodAlias, 'en'))
      .map(entry => buildPetFoodViewEntry(entry))
  }
}

function buyPet(state, petAlias, options = {}) {
  syncFarmState(state, options.now ?? Date.now())
  if (!isFarmSocialUnlocked(state)) {
    return { ok: false, reason: 'feature_locked' }
  }

  const pet = getPetByAlias(petAlias)
  if (!pet) {
    return { ok: false, reason: 'unknown_pet' }
  }

  if (getPetEntry(state, pet.alias)) {
    return { ok: false, reason: 'pet_owned', pet }
  }

  if (options.preview) {
    return {
      ok: true,
      pet,
      price: pet.price
    }
  }

  const now = options.now ?? Date.now()
  const beforeXp = state.farmXp
  const beforeLevel = state.farmLevel
  const initialGuardUntil = !state.activePetAlias
    ? now + (pet.guardBaseHours * HOUR_MS)
    : 0
  state.pets[pet.alias] = {
    petAlias: pet.alias,
    nameSnapshot: pet.name,
    guardInterceptPercentSnapshot: pet.guardInterceptPercent,
    guardBaseHoursSnapshot: pet.guardBaseHours,
    guardBonusPercentSnapshot: pet.guardBonusPercent,
    fatigueGainPerHourSnapshot: pet.fatigueGainPerHour,
    boughtAt: now,
    guardUntil: initialGuardUntil,
    level: 1,
    xp: 0,
    fatigue: 0,
    lifecycleSyncedAt: now,
    activeProgressMs: 0,
    restProgressMs: 0
  }
  state.stats.buyPetCount += 1
  if (!state.activePetAlias) {
    state.activePetAlias = pet.alias
    state.guardTrackedAt = now
  }

  const questSummary = progressMainQuests(state, now)
  touchFarmState(state)

  return {
    ok: true,
    pet,
    price: pet.price,
    ownedPet: buildPetViewEntry(state.pets[pet.alias], now),
    initialGuardHours: initialGuardUntil > now ? Math.floor((initialGuardUntil - now) / HOUR_MS) : 0,
    ...buildMutationMeta(state, beforeXp, beforeLevel, questSummary)
  }
}

function buyPetFood(state, foodAlias, count, options = {}) {
  syncFarmState(state, options.now ?? Date.now())
  if (!isFarmSocialUnlocked(state)) {
    return { ok: false, reason: 'feature_locked' }
  }

  const food = getPetFoodByAlias(foodAlias)
  if (!food) {
    return { ok: false, reason: 'unknown_food' }
  }

  const normalizedCount = normalizeCount(count)
  if (!isPositiveInteger(normalizedCount)) {
    return { ok: false, reason: 'invalid_count' }
  }

  if (options.preview) {
    return {
      ok: true,
      food,
      count: normalizedCount,
      totalCost: food.price * normalizedCount
    }
  }

  const now = options.now ?? Date.now()
  const beforeXp = state.farmXp
  const beforeLevel = state.farmLevel
  addPetFoodInventory(state, food, normalizedCount)
  state.stats.buyPetFoodCount += normalizedCount

  const questSummary = progressMainQuests(state, now)
  touchFarmState(state)

  return {
    ok: true,
    food,
    count: normalizedCount,
    totalCost: food.price * normalizedCount,
    inventoryCount: state.petFoods[food.alias].count,
    inventoryEntry: buildPetFoodViewEntry(state.petFoods[food.alias]),
    ...buildMutationMeta(state, beforeXp, beforeLevel, questSummary)
  }
}

function usePet(state, petAlias, now = Date.now()) {
  syncFarmState(state, now)
  if (!isFarmSocialUnlocked(state)) {
    return { ok: false, reason: 'feature_locked' }
  }

  const normalizedAlias = normalizeAlias(petAlias)
  const petEntry = getPetEntry(state, normalizedAlias)
  if (!petEntry) {
    return { ok: false, reason: 'pet_not_owned' }
  }

  const beforeXp = state.farmXp
  const beforeLevel = state.farmLevel
  state.activePetAlias = normalizedAlias
  state.guardTrackedAt = now
  const questSummary = progressMainQuests(state, now)
  touchFarmState(state)

  return {
    ok: true,
    pet: buildPetViewEntry(petEntry, now),
    ...buildMutationMeta(state, beforeXp, beforeLevel, questSummary)
  }
}

function feedPet(state, foodAlias, count, now = Date.now()) {
  syncFarmState(state, now)
  if (!isFarmSocialUnlocked(state)) {
    return { ok: false, reason: 'feature_locked' }
  }

  const activePet = getActivePetEntry(state)
  if (!activePet) {
    return { ok: false, reason: 'no_active_pet' }
  }

  const food = resolvePetFoodForUse(state, foodAlias)
  if (!food) {
    return { ok: false, reason: 'unknown_food' }
  }

  const normalizedCount = normalizeCount(count)
  if (!isPositiveInteger(normalizedCount)) {
    return { ok: false, reason: 'invalid_count' }
  }

  const foodEntry = getPetFoodEntry(state, food.alias)
  if (!foodEntry || foodEntry.count <= 0) {
    return { ok: false, reason: 'food_missing' }
  }

  if (foodEntry.count < normalizedCount) {
    return {
      ok: false,
      reason: 'insufficient_food',
      available: foodEntry.count,
      food
    }
  }

  const beforeXp = state.farmXp
  const beforeLevel = state.farmLevel
  const maxUntil = now + FARM_PET_GUARD_CAP_MS
  const fatigueBefore = activePet.fatigue
  const petXpBefore = activePet.xp
  const levelBeforePet = activePet.level
  let usedCount = 0
  let actualAddedMs = 0

  while (usedCount < normalizedCount) {
    const baseUntil = Math.max(now, activePet.guardUntil)
    if (baseUntil >= maxUntil) {
      break
    }

    const addedHours = calculatePetFeedAddedHours(activePet, food)
    const unitAddedMs = Math.min(maxUntil - baseUntil, addedHours * HOUR_MS)
    if (unitAddedMs <= 0) {
      break
    }

    activePet.guardUntil = baseUntil + unitAddedMs
    actualAddedMs += unitAddedMs
    usedCount += 1
    activePet.fatigue = clamp(
      normalizeInteger(activePet.fatigue, 0) - Math.max(0, normalizeInteger(food.fatigueRecovery, 0)),
      0,
      100
    )
    gainPetXp(activePet, Math.max(0, normalizeInteger(food.xpReward, 0)))
  }

  if (actualAddedMs <= 0 || usedCount <= 0) {
    return { ok: false, reason: 'guard_full', pet: activePet }
  }

  foodEntry.count -= usedCount
  if (foodEntry.count <= 0) {
    delete state.petFoods[food.alias]
  }

  state.stats.feedPetAddedMs += actualAddedMs
  if (state.activePetAlias === activePet.petAlias) {
    state.guardTrackedAt = now
  }

  const questSummary = progressMainQuests(state, now)
  touchFarmState(state)

  return {
    ok: true,
    pet: buildPetViewEntry(activePet, now),
    food,
    usedCount,
    actualAddedHours: Math.floor(actualAddedMs / HOUR_MS),
    petXpGained: activePet.xp - petXpBefore,
    fatigueBefore,
    fatigueAfter: activePet.fatigue,
    petLevelBefore: levelBeforePet,
    petLevelAfter: activePet.level,
    guardUntil: activePet.guardUntil,
    ...buildMutationMeta(state, beforeXp, beforeLevel, questSummary)
  }
}

function getFarmVisitView(targetState, now = Date.now()) {
  syncFarmState(targetState, now)
  const activePet = getActivePetEntry(targetState)

  return {
    farmLevel: targetState.farmLevel,
    activePet: buildPetViewEntry(activePet, now),
    plots: targetState.plots
      .filter(plot => plot.owned)
      .map(plot => ({
        plotId: plot.plotId,
        landType: plot.landType,
        cropAlias: plot.cropAlias,
        nameSnapshot: plot.nameSnapshot,
        readyAt: plot.readyAt,
        watered: plot.watered,
        yieldTotalSnapshot: plot.yieldTotalSnapshot,
        yieldStolen: plot.yieldStolen,
        ready: isPlotReady(plot, now),
        visibleHarvest: isPlotReady(plot, now)
          ? Math.max(0, plot.yieldTotalSnapshot - plot.yieldStolen)
          : 0,
        canSteal: isPlotReady(plot, now) && plot.cropAlias && plot.yieldStolen <= 0 && (plot.yieldTotalSnapshot - plot.yieldStolen) > 1
      }))
  }
}

function visitFarm(state, targetState, targetUid, now = Date.now()) {
  syncFarmState(state, now)
  syncFarmState(targetState, now)
  if (!isFarmSocialUnlocked(state)) {
    return { ok: false, reason: 'feature_locked' }
  }

  const normalizedUid = normalizeInteger(targetUid, 0)
  if (!isPositiveInteger(normalizedUid)) {
    return { ok: false, reason: 'invalid_target' }
  }

  const beforeXp = state.farmXp
  const beforeLevel = state.farmLevel
  state.lastVisitedFarmUid = normalizedUid
  state.lastVisitedFarmAt = now
  state.stats.visitFarmCount += 1
  const questSummary = progressMainQuests(state, now)
  touchFarmState(state)

  return {
    ok: true,
    targetUid: normalizedUid,
    view: getFarmVisitView(targetState, now),
    ...buildMutationMeta(state, beforeXp, beforeLevel, questSummary)
  }
}

function stealFromFarm(attackerState, targetState, targetUid, plotId, now = Date.now()) {
  syncFarmState(attackerState, now)
  syncFarmState(targetState, now)
  if (!isFarmSocialUnlocked(attackerState)) {
    return { ok: false, reason: 'feature_locked' }
  }

  const normalizedUid = normalizeInteger(targetUid, 0)
  if (!isPositiveInteger(normalizedUid)) {
    return { ok: false, reason: 'invalid_target' }
  }

  if (attackerState.lastVisitedFarmUid !== normalizedUid) {
    return { ok: false, reason: 'visit_required' }
  }

  if (attackerState.dailyStealAttempts >= FARM_DAILY_STEAL_LIMIT) {
    return { ok: false, reason: 'attempt_limit' }
  }

  const plot = getPlotById(targetState, plotId)
  if (!plot) {
    return { ok: false, reason: 'plot_out_of_range' }
  }

  if (!plot.owned) {
    return { ok: false, reason: 'plot_not_owned', plot }
  }

  if (isPlotEmpty(plot)) {
    return { ok: false, reason: 'plot_empty', plot }
  }

  if (!isPlotReady(plot, now)) {
    return { ok: false, reason: 'plot_not_ready', plot }
  }

  if (plot.yieldStolen > 0) {
    return { ok: false, reason: 'already_stolen', plot }
  }

  const beforeXp = attackerState.farmXp
  const beforeLevel = attackerState.farmLevel
  attackerState.dailyStealAttempts += 1
  attackerState.stats.attemptStealCount += 1

  const activePet = getActivePetEntry(targetState)
  const interceptRate = activePet && activePet.guardUntil > now
    ? getPetEffectiveInterceptPercent(activePet) / 100
    : 0
  if (interceptRate > 0 && nextRandom() < interceptRate) {
    const questSummary = progressMainQuests(attackerState, now)
    pushFarmNotification(targetState, `有访客想偷 ${plot.plotId} 号地的 ${plot.nameSnapshot}，被 ${activePet.nameSnapshot} 拦下啦喵~`)
    touchFarmState(attackerState)
    touchFarmState(targetState)
    return {
      ok: false,
      reason: 'pet_blocked',
      plot,
      activePet: buildPetViewEntry(activePet, now),
      ...buildMutationMeta(attackerState, beforeXp, beforeLevel, questSummary)
    }
  }

  const stealRoll = nextRandom()
  const desiredCount = stealRoll < 0.65 ? 1 : (stealRoll < 0.85 ? 2 : 0)
  const maxSteal = Math.max(0, (plot.yieldTotalSnapshot - plot.yieldStolen) - 1)
  if (desiredCount <= 0 || maxSteal <= 0) {
    const questSummary = progressMainQuests(attackerState, now)
    touchFarmState(attackerState)
    return {
      ok: false,
      reason: maxSteal <= 0 ? 'owner_min_keep' : 'steal_failed',
      plot,
      ...buildMutationMeta(attackerState, beforeXp, beforeLevel, questSummary)
    }
  }

  const stolenCount = Math.min(desiredCount, maxSteal)
  if (stolenCount <= 0) {
    const questSummary = progressMainQuests(attackerState, now)
    touchFarmState(attackerState)
    return {
      ok: false,
      reason: 'owner_min_keep',
      plot,
      ...buildMutationMeta(attackerState, beforeXp, beforeLevel, questSummary)
    }
  }

  addCropInventory(attackerState, {
    cropAlias: plot.cropAlias,
    count: stolenCount,
    nameSnapshot: plot.nameSnapshot,
    sellPriceSnapshot: plot.sellPriceSnapshot
  })
  plot.yieldStolen += stolenCount
  attackerState.stats.successfulStealCount += 1
  attackerState.stats.stolenUnits += stolenCount
  gainFarmXp(attackerState, stolenCount * 8)

  const questSummary = progressMainQuests(attackerState, now)
  pushFarmNotification(targetState, `你的 ${plot.plotId} 号地 ${plot.nameSnapshot} 被偷走了 x${stolenCount}，还剩 ${Math.max(0, plot.yieldTotalSnapshot - plot.yieldStolen)} 喵~`)
  touchFarmState(attackerState)
  touchFarmState(targetState)

  return {
    ok: true,
    cropAlias: plot.cropAlias,
    cropNameSnapshot: plot.nameSnapshot,
    stolenCount,
    plotId: plot.plotId,
    remainingForOwner: Math.max(0, plot.yieldTotalSnapshot - plot.yieldStolen),
    ...buildMutationMeta(attackerState, beforeXp, beforeLevel, questSummary)
  }
}

function consumeFarmNotifications(state) {
  syncFarmState(state)
  const notifications = Array.isArray(state.notifications) ? [...state.notifications] : []
  if (notifications.length) {
    state.notifications = []
    touchFarmState(state)
  }
  return notifications
}

function cloneRegistryView() {
  ensureFarmReady()
  return cloneData(farmRegistry)
}

function cloneAddonStatusView() {
  ensureFarmReady()
  return cloneData(farmAddonStatus)
}

export function getFarmRegistry() {
  return cloneRegistryView()
}

export function getFarmAddonStatus() {
  return cloneAddonStatusView()
}

export function getFarmState(userId) {
  return ensureFarmState(userId)
}

export function getFarmDataPersistenceSnapshot() {
  ensureFarmReady()
  assertFarmPersistenceReady()
  return {
    filePath: farmConfig.farmDataPath,
    content: serializeFarmStates()
  }
}

export function acknowledgeFarmDataPersistenceSnapshot(snapshot) {
  if (!snapshot?.content) {
    return
  }

  if (serializeFarmStates() === snapshot.content) {
    farmDataDirty = false
  }
}

export {
  syncFarmState,
  saveFarmData,
  updateFarmProgress,
  recordFarmAction,
  getSeedSellPrice,
  buySeeds,
  plantSeed,
  waterPlots,
  harvestPlots,
  sellCrops,
  sellSeeds,
  deliverOrder,
  getFarmQuestView,
  getFarmDailyTaskView,
  getFarmLandView,
  getFarmLevelInfo,
  getUnlockedFarmCrops,
  getFarmPetView,
  getFarmVisitView,
  buyPlot,
  visitFarm,
  stealFromFarm,
  buyPet,
  buyPetFood,
  usePet,
  feedPet,
  consumeFarmNotifications
}

export function __configureFarmForTests(overrides = {}) {
  stopFarmWatcher()
  farmConfig = createFarmConfig(overrides)
  farmInitialized = false
  farmInitializing = false
  farmRegistry = createEmptyFarmRegistry()
  farmAddonStatus = createEmptyFarmAddonStatus()
  farmStates = new Map()
  farmDataDirty = false
  farmDataWriting = false
  farmDataFlushPromise = Promise.resolve()
  farmStateLoadError = ''
  ensureFarmReady()
  return {
    farmDataPath: farmConfig.farmDataPath,
    addonDirPath: farmConfig.addonDirPath,
    coreAddonPath: farmConfig.coreAddonPath
  }
}

export function __reloadFarmRegistryForTests(reason = 'test') {
  ensureFarmReady()
  return reloadFarmRegistry(reason)
}

export function __stopFarmWatcherForTests() {
  stopFarmWatcher()
}

export function __getFarmConfigForTests() {
  return { ...farmConfig }
}

export function __getFarmFlushPromiseForTests() {
  return farmDataFlushPromise
}
