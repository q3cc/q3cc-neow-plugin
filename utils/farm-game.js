import fs from 'fs'
import fsp from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const dataDirPath = path.join(__dirname, '../data/q3cc-neow-plugin')
const defaultFarmDataPath = path.join(dataDirPath, 'farm-state.json')
const defaultFarmAddonDirPath = path.join(dataDirPath, 'addons/farm')
const defaultCoreAddonPath = path.join(__dirname, '../resources/farm-core-addon.json')

export const FARM_SCHEMA_VERSION = 1
export const FARM_PLOT_COUNT = 4
export const FARM_ORDER_SLOT_COUNT = 3
export const FARM_ORDER_REFRESH_MS = 6 * 60 * 60 * 1000
export const FARM_ADDON_WATCH_DEBOUNCE_MS = 500

const FARM_ALIAS_PATTERN = /^[a-z0-9_-]+$/

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
    orderTemplates: []
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

function ensureFarmRuntimeDirs() {
  fs.mkdirSync(path.dirname(farmConfig.farmDataPath), { recursive: true })
  fs.mkdirSync(farmConfig.addonDirPath, { recursive: true })
}

function createEmptyPlot(plotId) {
  return {
    plotId,
    cropAlias: '',
    nameSnapshot: '',
    sellPriceSnapshot: 0,
    harvestYieldSnapshot: 0,
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
    createdAt: new Date().toISOString(),
    updatedAt: Date.now(),
    starterGrantApplied: false,
    plots: Array.from({ length: FARM_PLOT_COUNT }, (_, index) => createEmptyPlot(index + 1)),
    seeds: {},
    crops: {},
    orders: [],
    orderBoardExpiresAt: 0
  }
}

function cloneData(value) {
  return JSON.parse(JSON.stringify(value))
}

function normalizeUserId(userId) {
  return String(userId)
}

function isPositiveInteger(value) {
  return Number.isInteger(value) && value > 0
}

function isNonNegativeInteger(value) {
  return Number.isInteger(value) && value >= 0
}

function normalizeAlias(alias) {
  return String(alias || '').trim().toLowerCase()
}

function normalizeCount(count) {
  const parsed = Number(count)
  return Number.isInteger(parsed) ? parsed : NaN
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

function getCropByAlias(alias) {
  return farmRegistry.crops[normalizeAlias(alias)] || null
}

function getSeedEntry(state, alias) {
  return state.seeds?.[normalizeAlias(alias)] || null
}

function getCropEntry(state, alias) {
  return state.crops?.[normalizeAlias(alias)] || null
}

function getPlotById(state, plotId) {
  const normalizedPlotId = Number(plotId)
  if (!Number.isInteger(normalizedPlotId)) {
    return null
  }

  return state.plots.find(plot => plot.plotId === normalizedPlotId) || null
}

function isPlotEmpty(plot) {
  return !plot?.cropAlias
}

function isPlotReady(plot, now = Date.now()) {
  return !isPlotEmpty(plot) && (plot.readyAt || 0) <= now
}

function markFarmDataDirty() {
  farmDataDirty = true
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
        farmDataDirty = false
        await fsp.writeFile(farmConfig.farmDataPath, serializeFarmStates(), 'utf8')
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
  markFarmDataDirty()
  return flushFarmData()
}

function normalizeSeedEntry(alias, entry) {
  const normalizedAlias = normalizeAlias(alias)
  const normalizedCount = normalizeCount(entry?.count)
  if (!normalizedAlias || !FARM_ALIAS_PATTERN.test(normalizedAlias) || !isPositiveInteger(normalizedCount)) {
    return null
  }

  return {
    cropAlias: normalizedAlias,
    count: normalizedCount,
    nameSnapshot: String(entry?.nameSnapshot || '').trim(),
    seedNameSnapshot: String(entry?.seedNameSnapshot || '').trim(),
    seedPriceSnapshot: isNonNegativeInteger(Number(entry?.seedPriceSnapshot))
      ? Number(entry.seedPriceSnapshot)
      : 0
  }
}

function normalizeCropEntry(alias, entry) {
  const normalizedAlias = normalizeAlias(alias)
  const normalizedCount = normalizeCount(entry?.count)
  if (!normalizedAlias || !FARM_ALIAS_PATTERN.test(normalizedAlias) || !isPositiveInteger(normalizedCount)) {
    return null
  }

  return {
    cropAlias: normalizedAlias,
    count: normalizedCount,
    nameSnapshot: String(entry?.nameSnapshot || '').trim(),
    sellPriceSnapshot: isNonNegativeInteger(Number(entry?.sellPriceSnapshot))
      ? Number(entry.sellPriceSnapshot)
      : 0
  }
}

function normalizePlot(plot, index) {
  const emptyPlot = createEmptyPlot(index + 1)
  if (!plot || typeof plot !== 'object') {
    return emptyPlot
  }

  const normalizedAlias = normalizeAlias(plot.cropAlias)
  if (!normalizedAlias) {
    return {
      ...emptyPlot,
      plotId: Number.isInteger(plot.plotId) ? plot.plotId : emptyPlot.plotId
    }
  }

  return {
    plotId: Number.isInteger(plot.plotId) ? plot.plotId : emptyPlot.plotId,
    cropAlias: normalizedAlias,
    nameSnapshot: String(plot.nameSnapshot || '').trim(),
    sellPriceSnapshot: isNonNegativeInteger(Number(plot.sellPriceSnapshot))
      ? Number(plot.sellPriceSnapshot)
      : 0,
    harvestYieldSnapshot: isPositiveInteger(Number(plot.harvestYieldSnapshot))
      ? Number(plot.harvestYieldSnapshot)
      : 1,
    growMinutesSnapshot: isPositiveInteger(Number(plot.growMinutesSnapshot))
      ? Number(plot.growMinutesSnapshot)
      : 1,
    waterStaminaSnapshot: isNonNegativeInteger(Number(plot.waterStaminaSnapshot))
      ? Number(plot.waterStaminaSnapshot)
      : 0,
    waterBaseReductionPercentSnapshot: isNonNegativeInteger(Number(plot.waterBaseReductionPercentSnapshot))
      ? Number(plot.waterBaseReductionPercentSnapshot)
      : 0,
    plantedAt: Number(plot.plantedAt) || 0,
    readyAt: Number(plot.readyAt) || 0,
    watered: Boolean(plot.watered)
  }
}

function normalizeOrder(order, index, expiresAt) {
  if (!order || typeof order !== 'object') {
    return null
  }

  const cropAlias = normalizeAlias(order.cropAlias)
  const requiredQty = Number(order.requiredQty)
  const coinReward = Number(order.coinReward)
  const favorReward = Number(order.favorReward)

  if (!cropAlias || !FARM_ALIAS_PATTERN.test(cropAlias) || !isPositiveInteger(requiredQty)) {
    return null
  }

  return {
    slot: index + 1,
    cropAlias,
    cropNameSnapshot: String(order.cropNameSnapshot || '').trim(),
    requiredQty,
    coinReward: isNonNegativeInteger(coinReward) ? coinReward : 0,
    favorReward: isNonNegativeInteger(favorReward) ? favorReward : 0,
    expiresAt: Number(order.expiresAt) || expiresAt || 0
  }
}

function sanitizeFarmState(state) {
  const normalizedState = {
    ...createDefaultFarmState(),
    ...(state && typeof state === 'object' ? state : {})
  }

  normalizedState.starterGrantApplied = Boolean(normalizedState.starterGrantApplied)
  normalizedState.plots = Array.from({ length: FARM_PLOT_COUNT }, (_, index) =>
    normalizePlot(normalizedState.plots?.[index], index)
  )
  normalizedState.seeds = Object.fromEntries(
    Object.entries(normalizedState.seeds || {})
      .map(([alias, entry]) => [normalizeAlias(alias), normalizeSeedEntry(alias, entry)])
      .filter(([, entry]) => Boolean(entry))
  )
  normalizedState.crops = Object.fromEntries(
    Object.entries(normalizedState.crops || {})
      .map(([alias, entry]) => [normalizeAlias(alias), normalizeCropEntry(alias, entry)])
      .filter(([, entry]) => Boolean(entry))
  )
  normalizedState.orderBoardExpiresAt = Number(normalizedState.orderBoardExpiresAt) || 0
  normalizedState.orders = Array.from({ length: FARM_ORDER_SLOT_COUNT }, (_, index) =>
    normalizeOrder(normalizedState.orders?.[index], index, normalizedState.orderBoardExpiresAt)
  ).filter(Boolean)

  return normalizedState
}

function loadFarmStates() {
  farmStates = new Map()

  try {
    if (!fs.existsSync(farmConfig.farmDataPath)) {
      return
    }

    const raw = JSON.parse(fs.readFileSync(farmConfig.farmDataPath, 'utf8'))
    for (const [userId, state] of Object.entries(raw || {})) {
      farmStates.set(normalizeUserId(userId), sanitizeFarmState(state))
    }
  } catch {
    farmStates = new Map()
  }

  for (const state of farmStates.values()) {
    syncFarmState(state)
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

  if (manifest.schemaVersion !== FARM_SCHEMA_VERSION) {
    return { ok: false, reason: `${source} 的 schemaVersion 必须为 ${FARM_SCHEMA_VERSION}` }
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

  return {
    ok: true,
    manifest: {
      schemaVersion: FARM_SCHEMA_VERSION,
      id,
      name,
      version,
      enabled: manifest.enabled,
      priority: manifest.priority,
      starterGrants: manifest.starterGrants,
      crops: manifest.crops,
      orderTemplates: manifest.orderTemplates
    }
  }
}

function validateCropDefinition(rawCrop, source) {
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
      orderFavorReward: Number(rawCrop.orderFavorReward)
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

function validateOrderTemplate(rawTemplate, source) {
  if (!rawTemplate || typeof rawTemplate !== 'object' || Array.isArray(rawTemplate)) {
    return { ok: false, reason: `${source} 的 orderTemplate 结构不合法` }
  }

  const cropAlias = normalizeAlias(rawTemplate.cropAlias)
  if (!cropAlias || !FARM_ALIAS_PATTERN.test(cropAlias)) {
    return { ok: false, reason: `${source} 的 orderTemplate.cropAlias 不合法` }
  }

  const qtyMin = Number(rawTemplate.qtyMin)
  const qtyMax = Number(rawTemplate.qtyMax)
  const coinBonusPerUnit = Number(rawTemplate.coinBonusPerUnit)
  const weight = Number(rawTemplate.weight)

  if (!isPositiveInteger(qtyMin) || !isPositiveInteger(qtyMax) || qtyMax < qtyMin) {
    return { ok: false, reason: `${source} 的 orderTemplate ${cropAlias} 数量范围不合法` }
  }

  if (!isNonNegativeInteger(coinBonusPerUnit)) {
    return { ok: false, reason: `${source} 的 orderTemplate ${cropAlias} coinBonusPerUnit 不合法` }
  }

  if (!isPositiveInteger(weight)) {
    return { ok: false, reason: `${source} 的 orderTemplate ${cropAlias} weight 不合法` }
  }

  return {
    ok: true,
    template: {
      cropAlias,
      qtyMin,
      qtyMax,
      coinBonusPerUnit,
      weight
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
  const seenAliases = new Set()

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

    const packageCrops = []
    const packageAliases = new Set()
    let packageError = ''

    for (const rawCrop of manifest.crops) {
      const cropResult = validateCropDefinition(rawCrop, source)
      if (!cropResult.ok) {
        packageError = cropResult.reason
        break
      }

      if (packageAliases.has(cropResult.crop.alias)) {
        packageError = `${source} 内部重复声明了 crop alias ${cropResult.crop.alias}`
        break
      }

      if (seenAliases.has(cropResult.crop.alias)) {
        packageError = `${source} 的 crop alias ${cropResult.crop.alias} 与已有附加件冲突`
        break
      }

      packageAliases.add(cropResult.crop.alias)
      packageCrops.push(cropResult.crop)
    }

    if (packageError) {
      skippedAddons.push(makeSkipRecord(source, manifest, packageError))
      continue
    }

    const availableAliases = new Set([...seenAliases, ...packageAliases])
    const packageStarterGrants = []
    for (const rawGrant of manifest.starterGrants) {
      const grantResult = validateStarterGrant(rawGrant, source, availableAliases)
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

      if (!availableAliases.has(templateResult.template.cropAlias)) {
        skippedAddons.push(makeSkipRecord(source, manifest, `订单模板 ${templateResult.template.cropAlias} 未找到对应 crop，已跳过该模板`))
        continue
      }

      packageOrderTemplates.push(templateResult.template)
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
      seenAliases.add(crop.alias)
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
    if (left.seedPrice !== right.seedPrice) {
      return left.seedPrice - right.seedPrice
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

function applyStarterGrants(state) {
  for (const grant of farmRegistry.starterGrants) {
    const crop = getCropByAlias(grant.cropAlias)
    if (!crop) {
      continue
    }

    if (grant.seedCount > 0) {
      const currentSeed = state.seeds[crop.alias] || {
        cropAlias: crop.alias,
        count: 0,
        nameSnapshot: crop.name,
        seedNameSnapshot: crop.seedName,
        seedPriceSnapshot: crop.seedPrice
      }

      currentSeed.count += grant.seedCount
      currentSeed.nameSnapshot = crop.name
      currentSeed.seedNameSnapshot = crop.seedName
      currentSeed.seedPriceSnapshot = crop.seedPrice
      state.seeds[crop.alias] = currentSeed
    }

    if (grant.cropCount > 0) {
      const currentCrop = state.crops[crop.alias] || {
        cropAlias: crop.alias,
        count: 0,
        nameSnapshot: crop.name,
        sellPriceSnapshot: crop.sellPrice
      }

      currentCrop.count += grant.cropCount
      currentCrop.nameSnapshot = crop.name
      currentCrop.sellPriceSnapshot = crop.sellPrice
      state.crops[crop.alias] = currentCrop
    }
  }

  state.starterGrantApplied = true
}

function createOrder(expiresAt, slot) {
  const template = rollWeighted(farmRegistry.orderTemplates)
  if (!template) {
    return null
  }

  const crop = getCropByAlias(template.cropAlias)
  if (!crop) {
    return null
  }

  const requiredQty = rollInt(template.qtyMin, template.qtyMax)
  return {
    slot,
    cropAlias: crop.alias,
    cropNameSnapshot: crop.name,
    requiredQty,
    coinReward: requiredQty * (crop.sellPrice + template.coinBonusPerUnit),
    favorReward: crop.orderFavorReward,
    expiresAt
  }
}

function refreshOrderBoard(state, now = Date.now()) {
  const expiresAt = now + FARM_ORDER_REFRESH_MS
  const orders = []

  for (let index = 0; index < FARM_ORDER_SLOT_COUNT; index++) {
    const order = createOrder(expiresAt, index + 1)
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

    const created = createOrder(state.orderBoardExpiresAt, index + 1)
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
}

function syncFarmState(state, now = Date.now()) {
  ensureFarmReady()

  let changed = false
  const serializedBefore = JSON.stringify(state)
  const normalized = sanitizeFarmState(state)

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

  if (state.orders.length !== FARM_ORDER_SLOT_COUNT || !state.orderBoardExpiresAt || state.orderBoardExpiresAt <= now) {
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

  if (changed) {
    touchFarmState(state)
    void flushFarmData()
  }

  return state
}

function ensureFarmState(userId) {
  ensureFarmReady()

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

  const currentSeed = state.seeds[preview.crop.alias] || {
    cropAlias: preview.crop.alias,
    count: 0,
    nameSnapshot: preview.crop.name,
    seedNameSnapshot: preview.crop.seedName,
    seedPriceSnapshot: preview.crop.seedPrice
  }

  currentSeed.count += preview.count
  currentSeed.nameSnapshot = preview.crop.name
  currentSeed.seedNameSnapshot = preview.crop.seedName
  currentSeed.seedPriceSnapshot = preview.crop.seedPrice
  state.seeds[preview.crop.alias] = currentSeed
  touchFarmState(state)

  return {
    ok: true,
    crop: preview.crop,
    count: preview.count,
    totalCost: preview.totalCost,
    inventoryCount: currentSeed.count
  }
}

function previewPlantSeed(state, plotId, seedAlias, now = Date.now()) {
  syncFarmState(state, now)

  const plot = getPlotById(state, plotId)
  if (!plot) {
    return { ok: false, reason: 'plot_out_of_range' }
  }

  if (!isPlotEmpty(plot)) {
    return { ok: false, reason: 'plot_occupied', plot }
  }

  const crop = getCropByAlias(seedAlias)
  if (!crop) {
    return { ok: false, reason: 'unknown_crop' }
  }

  const seedEntry = getSeedEntry(state, crop.alias)
  if (!seedEntry || seedEntry.count <= 0) {
    return { ok: false, reason: 'seed_missing', crop }
  }

  return {
    ok: true,
    crop,
    plot,
    staminaCost: crop.plantStamina,
    readyAt: now + (crop.growMinutes * 60 * 1000)
  }
}

function plantSeed(state, plotId, seedAlias, now = Date.now(), options = {}) {
  const preview = previewPlantSeed(state, plotId, seedAlias, now)
  if (!preview.ok || options.preview) {
    return preview
  }

  const plot = preview.plot
  const seedEntry = getSeedEntry(state, preview.crop.alias)
  seedEntry.count -= 1
  if (seedEntry.count <= 0) {
    delete state.seeds[preview.crop.alias]
  }

  Object.assign(plot, {
    cropAlias: preview.crop.alias,
    nameSnapshot: preview.crop.name,
    sellPriceSnapshot: preview.crop.sellPrice,
    harvestYieldSnapshot: preview.crop.harvestYield,
    growMinutesSnapshot: preview.crop.growMinutes,
    waterStaminaSnapshot: preview.crop.waterStamina,
    waterBaseReductionPercentSnapshot: preview.crop.waterBaseReductionPercent,
    plantedAt: now,
    readyAt: preview.readyAt,
    watered: false
  })
  touchFarmState(state)

  return {
    ok: true,
    crop: preview.crop,
    plot,
    staminaCost: preview.staminaCost,
    readyAt: preview.readyAt
  }
}

function getPlotWaterCost(plot) {
  const crop = getCropByAlias(plot.cropAlias)
  return crop?.waterStamina ?? plot.waterStaminaSnapshot ?? 0
}

function getPlotWaterReductionMs(plot) {
  const crop = getCropByAlias(plot.cropAlias)
  const growMinutes = crop?.growMinutes ?? plot.growMinutesSnapshot ?? 0
  const reductionPercent = crop?.waterBaseReductionPercent ?? plot.waterBaseReductionPercentSnapshot ?? 0
  return Math.floor(growMinutes * 60 * 1000 * (reductionPercent / 100))
}

function previewWaterPlots(state, target, now = Date.now()) {
  syncFarmState(state, now)

  const targetText = String(target || '').trim().toLowerCase()
  const selectedPlots = targetText === 'all'
    ? state.plots.filter(plot => !isPlotEmpty(plot))
    : [getPlotById(state, Number(target))]

  if (targetText === 'all' && !selectedPlots.length) {
    return { ok: false, reason: 'no_eligible_plots' }
  }

  if (!selectedPlots.length || selectedPlots.includes(null)) {
    return { ok: false, reason: 'plot_out_of_range' }
  }

  if (targetText !== 'all') {
    const plot = selectedPlots[0]
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
    plot && !isPlotEmpty(plot) && !isPlotReady(plot, now) && !plot.watered
  )

  if (!eligiblePlots.length) {
    return { ok: false, reason: 'no_eligible_plots' }
  }

  const staminaCost = eligiblePlots.reduce((sum, plot) => sum + getPlotWaterCost(plot), 0)
  return {
    ok: true,
    plots: eligiblePlots,
    staminaCost
  }
}

function waterPlots(state, target, now = Date.now(), options = {}) {
  const preview = previewWaterPlots(state, target, now)
  if (!preview.ok || options.preview) {
    return preview
  }

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

  touchFarmState(state)

  return {
    ok: true,
    plots: wateredPlots,
    staminaCost: preview.staminaCost
  }
}

function addHarvestedCrop(state, plot) {
  const currentCrop = state.crops[plot.cropAlias] || {
    cropAlias: plot.cropAlias,
    count: 0,
    nameSnapshot: plot.nameSnapshot,
    sellPriceSnapshot: plot.sellPriceSnapshot
  }

  currentCrop.count += plot.harvestYieldSnapshot || 1
  currentCrop.nameSnapshot = plot.nameSnapshot || currentCrop.nameSnapshot
  currentCrop.sellPriceSnapshot = plot.sellPriceSnapshot || currentCrop.sellPriceSnapshot
  state.crops[plot.cropAlias] = currentCrop
}

function previewHarvestPlots(state, target, now = Date.now()) {
  syncFarmState(state, now)

  const targetText = String(target || '').trim().toLowerCase()
  const selectedPlots = targetText === 'all'
    ? state.plots.filter(plot => !isPlotEmpty(plot))
    : [getPlotById(state, Number(target))]

  if (targetText === 'all' && !selectedPlots.length) {
    return { ok: false, reason: 'no_ready_plots' }
  }

  if (!selectedPlots.length || selectedPlots.includes(null)) {
    return { ok: false, reason: 'plot_out_of_range' }
  }

  if (targetText !== 'all') {
    const plot = selectedPlots[0]
    if (isPlotEmpty(plot)) {
      return { ok: false, reason: 'plot_empty', plot }
    }

    if (!isPlotReady(plot, now)) {
      return { ok: false, reason: 'not_ready', plot }
    }
  }

  const readyPlots = selectedPlots.filter(plot => plot && isPlotReady(plot, now))
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

  const harvested = []
  for (const plot of preview.plots) {
    addHarvestedCrop(state, plot)
    harvested.push({
      plotId: plot.plotId,
      cropAlias: plot.cropAlias,
      nameSnapshot: plot.nameSnapshot,
      count: plot.harvestYieldSnapshot || 1
    })
    Object.assign(plot, createEmptyPlot(plot.plotId))
  }

  touchFarmState(state)

  return {
    ok: true,
    harvested
  }
}

function sellCrops(state, cropAlias, count) {
  syncFarmState(state)

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
  touchFarmState(state)

  return {
    ok: true,
    cropAlias: normalizedAlias,
    cropNameSnapshot: cropEntry.nameSnapshot,
    soldCount: normalizedCount,
    coinReward: normalizedCount * cropEntry.sellPriceSnapshot
  }
}

function replaceOrderSlot(state, slotIndex, now = Date.now()) {
  if (!state.orderBoardExpiresAt || state.orderBoardExpiresAt <= now) {
    refreshOrderBoard(state, now)
    return
  }

  const replacement = createOrder(state.orderBoardExpiresAt, slotIndex + 1)
  if (replacement) {
    state.orders[slotIndex] = replacement
  } else {
    state.orders.splice(slotIndex, 1)
  }
}

function deliverOrder(state, orderIndex, now = Date.now()) {
  syncFarmState(state, now)

  const slotIndex = Number(orderIndex) - 1
  if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= state.orders.length) {
    return { ok: false, reason: 'order_missing' }
  }

  const order = state.orders[slotIndex]
  if (!order) {
    return { ok: false, reason: 'order_missing' }
  }

  const cropEntry = getCropEntry(state, order.cropAlias)
  if (!cropEntry || cropEntry.count < order.requiredQty) {
    return {
      ok: false,
      reason: 'insufficient_inventory',
      available: cropEntry?.count || 0,
      required: order.requiredQty,
      order
    }
  }

  cropEntry.count -= order.requiredQty
  if (cropEntry.count <= 0) {
    delete state.crops[order.cropAlias]
  }

  const completedOrder = cloneData(order)
  replaceOrderSlot(state, slotIndex, now)
  touchFarmState(state)

  return {
    ok: true,
    order: completedOrder,
    replacement: state.orders[slotIndex] || null,
    coinReward: completedOrder.coinReward,
    favorReward: completedOrder.favorReward
  }
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

export { syncFarmState, saveFarmData, buySeeds, plantSeed, waterPlots, harvestPlots, sellCrops, deliverOrder }

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
