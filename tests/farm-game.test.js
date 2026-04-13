import fs from 'fs'
import fsp from 'fs/promises'
import path from 'path'
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  FARM_ORDER_SLOT_COUNT,
  __configureFarmForTests,
  __getFarmConfigForTests,
  __getFarmFlushPromiseForTests,
  __reloadFarmRegistryForTests,
  __stopFarmWatcherForTests,
  buyPet,
  buyPetFood,
  buyPlot,
  buySeeds,
  deliverOrder,
  feedPet,
  getFarmAddonStatus,
  getFarmLevelInfo,
  getFarmQuestView,
  getFarmRegistry,
  getFarmState,
  getUnlockedFarmCrops,
  harvestPlots,
  plantSeed,
  recordFarmAction,
  sellCrops,
  sellSeeds,
  stealFromFarm,
  syncFarmState,
  updateFarmProgress,
  usePet,
  visitFarm,
  waterPlots
} from '../utils/farm-game.js'

const coreAddonPath = path.join(process.cwd(), 'resources/farm-core-addon.json')
const crop = (alias, name, extras = {}) => ({ alias, name, seedName: `${name}种子`, seedPrice: 9, growMinutes: 20, plantStamina: 5, waterStamina: 2, waterBaseReductionPercent: 25, harvestYield: 1, sellPrice: 14, orderFavorReward: 2, ...extras })
const rand = values => { let i = 0; return () => values[Math.min(i++, values.length - 1)] }
const writeJson = (filePath, data) => fsp.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8')
async function env(options = {}) {
  const rootDir = await fsp.mkdtemp(path.join('/tmp', 'farm-v2-'))
  const addonDirPath = path.join(rootDir, 'addons')
  const farmDataPath = path.join(rootDir, 'farm-state.json')
  await fsp.mkdir(addonDirPath, { recursive: true })
  if (options.seedData) {
    await writeJson(farmDataPath, options.seedData)
  }
  __configureFarmForTests({ addonDirPath, farmDataPath, coreAddonPath, watchEnabled: options.watchEnabled ?? false, watchDebounceMs: options.watchDebounceMs ?? 25, random: options.random })
  return { rootDir, addonDirPath, farmDataPath }
}
async function cleanup(testEnv) {
  __stopFarmWatcherForTests()
  await __getFarmFlushPromiseForTests()
  await fsp.rm(testEnv.rootDir, { recursive: true, force: true })
}
async function waitFor(check, timeoutMs = 1500) {
  const start = Date.now()
  while (Date.now() - start <= timeoutMs) {
    try { check(); return } catch { await new Promise(resolve => setTimeout(resolve, 25)) }
  }
  check()
}
const setHighLevel = state => { state.farmXp = 100000 }

test('schema v1/v2 附加件可同时加载，冲突与坏引用会被跳过', async () => {
  const t = await env()
  try {
    await writeJson(path.join(t.addonDirPath, 'tea.json'), { schemaVersion: 1, id: 'tea-pack', name: '茶园', version: '1.0.0', enabled: true, priority: 8, starterGrants: [], crops: [crop('green-tea', '青茶')], orderTemplates: [{ cropAlias: 'green-tea', qtyMin: 1, qtyMax: 2, coinBonusPerUnit: 2, weight: 1 }] })
    await writeJson(path.join(t.addonDirPath, 'combo.json'), { schemaVersion: 2, id: 'combo-pack', name: '拼盘包', version: '1.0.0', enabled: true, priority: 6, starterGrants: [], crops: [crop('lettuce', '生菜'), crop('bean', '豆角')], orderTemplates: [{ requirements: [{ cropAlias: 'lettuce', qtyMin: 1, qtyMax: 2 }, { cropAlias: 'bean', qtyMin: 2, qtyMax: 3 }], coinBonusPerUnit: 3, weight: 2 }] })
    await writeJson(path.join(t.addonDirPath, 'pet.json'), { schemaVersion: 2, id: 'pet-pack', name: '宠物包', version: '1.0.0', enabled: true, priority: 7, starterGrants: [], crops: [], orderTemplates: [{ cropAlias: 'ghost', qtyMin: 1, qtyMax: 1, coinBonusPerUnit: 1, weight: 1 }], pets: [{ alias: 'raven', name: '乌鸦', price: 100, guardInterceptPercent: 20 }], petFoods: [{ alias: 'snack', name: '零食', price: 10, guardHours: 1 }], mainQuestChapters: [{ id: 'miniquest', name: '访客', steps: [{ type: 'visit_farm', target: 1, label: '看别人一眼' }] }] })
    await writeJson(path.join(t.addonDirPath, 'dup.json'), { schemaVersion: 1, id: 'tea-pack', name: '重复包', version: '1.0.0', enabled: true, priority: 1, starterGrants: [], crops: [], orderTemplates: [] })
    __reloadFarmRegistryForTests('mix')
    const registry = getFarmRegistry()
    const status = getFarmAddonStatus()
    assert.ok(registry.cropList.some(item => item.alias === 'green-tea'))
    assert.ok(registry.cropList.some(item => item.alias === 'lettuce'))
    assert.ok(registry.petList.some(item => item.alias === 'raven'))
    assert.ok(registry.petFoodList.some(item => item.alias === 'snack'))
    assert.ok(registry.mainQuestChapterList.some(item => item.id === 'miniquest'))
    assert.equal(registry.orderTemplates.find(item => item.addonId === 'tea-pack').requirements.length, 1)
    assert.equal(registry.orderTemplates.find(item => item.addonId === 'combo-pack').requirements.length, 2)
    assert.ok(status.skippedAddons.some(item => item.reason.includes('ghost')))
    assert.ok(status.skippedAddons.some(item => item.id === 'tea-pack' || item.source.includes('dup.json')))
  } finally { await cleanup(t) }
})

test('旧存档会迁移到 15 地块、Lv20 与教程完成状态', async () => {
  const t = await env({ seedData: { legacy: { createdAt: '2026-01-01T00:00:00.000Z', starterGrantApplied: true, plots: Array.from({ length: 4 }, (_, i) => ({ plotId: i + 1, cropAlias: '', readyAt: 0 })), seeds: { radish: { cropAlias: 'radish', count: 3, nameSnapshot: '白萝卜', seedNameSnapshot: '白萝卜种子', seedPriceSnapshot: 4 } }, crops: {}, orders: [] } } })
  try {
    const state = getFarmState('legacy')
    assert.equal(state.plots.length, 15)
    assert.equal(state.plots[4].owned, true)
    assert.equal(state.plots[5].owned, false)
    assert.equal(state.farmLevel, 20)
    assert.ok(state.mainQuests.tutorial.completedAt > 0)
    assert.equal(state.seeds.radish.count, 3)
  } finally { await cleanup(t) }
})

test('25 种核心作物按等级解锁，土地倍率与购地规则生效', async () => {
  const t = await env()
  try {
    const low = getFarmState('low')
    assert.equal(getUnlockedFarmCrops(low).length, 5)
    assert.equal(buyPlot(low, 6, { preview: true }).reason, 'plot_locked_by_level')
    const high = getFarmState('high')
    setHighLevel(high)
    assert.equal(getUnlockedFarmCrops(high).length, 25)
    assert.equal(buyPlot(high, 6, { now: 0 }).ok, true)
    assert.equal(buyPlot(high, 11, { now: 0 }).ok, true)
    buySeeds(high, 'radish', 3)
    const yellow = plantSeed(high, 6, 'radish', 0)
    const black = plantSeed(high, 11, 'radish', 0)
    assert.equal(high.plots[5].yieldTotalSnapshot, 2)
    assert.equal(high.plots[10].yieldTotalSnapshot, 2)
    assert.ok(black.readyAt < yellow.readyAt)
  } finally { await cleanup(t) }
})

test('订单板会补满 5 单，并在过期后整板刷新', async () => {
  const t = await env({ random: rand([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]) })
  try {
    const state = getFarmState('board')
    const firstExpiresAt = state.orderBoardExpiresAt
    assert.equal(state.orders.length, FARM_ORDER_SLOT_COUNT)
    assert.deepEqual(state.orders.map(item => item.slot), [1, 2, 3, 4, 5])
    assert.equal(state.orders.every(item => Array.isArray(item.requirements) && item.requirements.length >= 2), true)
    syncFarmState(state, firstExpiresAt + 1)
    assert.equal(state.orders.length, FARM_ORDER_SLOT_COUNT)
    assert.ok(state.orderBoardExpiresAt > firstExpiresAt)
  } finally { await cleanup(t) }
})

test('旧的 3 单订单板会保留旧订单并补满到 5 单', async () => {
  const future = Date.now() + 60_000
  const t = await env({
    seedData: {
      legacyBoard: {
        starterGrantApplied: true,
        orderBoardExpiresAt: future,
        orders: [
          { slot: 1, cropAlias: 'radish', cropNameSnapshot: '白萝卜', requiredQty: 2, coinReward: 16, favorReward: 1, expiresAt: future },
          { slot: 2, cropAlias: 'tomato', cropNameSnapshot: '番茄', requiredQty: 2, coinReward: 16, favorReward: 1, expiresAt: future },
          { slot: 3, cropAlias: 'cabbage', cropNameSnapshot: '卷心菜', requiredQty: 2, coinReward: 16, favorReward: 1, expiresAt: future }
        ]
      }
    },
    random: rand([0, 0, 0, 0, 0, 0])
  })
  try {
    const state = getFarmState('legacyBoard')
    assert.equal(state.orders.length, FARM_ORDER_SLOT_COUNT)
    assert.equal(state.orders[0].requirements[0].cropAlias, 'radish')
    assert.equal(state.orders[1].requirements[0].cropAlias, 'tomato')
    assert.equal(state.orders[2].requirements[0].cropAlias, 'cabbage')
  } finally { await cleanup(t) }
})

test('教程主线完成时会补足到 Lv20，并发放宠物粮奖励', async () => {
  const t = await env()
  try {
    const state = getFarmState('quester')
    recordFarmAction(state, 'open_farm', 1)
    Object.assign(state.stats, { buySeedCount: 3, plantCount: 5, waterCount: 5, harvestUnits: 5, sellCropUnits: 10, deliverOrderCount: 3 })
    const result = updateFarmProgress(state, 2)
    const tutorial = getFarmQuestView(state, 2).find(item => item.chapterId === 'tutorial')
    assert.equal(tutorial.completed, true)
    assert.ok(result.questCoinReward >= 1000)
    assert.equal(state.farmLevel, 20)
    assert.ok(state.petFoods['small-feed'].count >= 3)
    assert.ok(state.petFoods['medium-feed'].count >= 1)
  } finally { await cleanup(t) }
})

test('农场主线按章节顺序逐步解锁显示', async () => {
  const t = await env()
  try {
    const state = getFarmState('quest-unlock')
    let questView = getFarmQuestView(state, 1)
    assert.deepEqual(questView.map(item => item.chapterId), ['tutorial'])

    recordFarmAction(state, 'open_farm', 1)
    Object.assign(state.stats, { buySeedCount: 3, plantCount: 5, waterCount: 5, harvestUnits: 5, sellCropUnits: 10, deliverOrderCount: 3 })
    updateFarmProgress(state, 2)
    questView = getFarmQuestView(state, 2)
    assert.deepEqual(questView.map(item => item.chapterId), ['tutorial', 'expansion'])
    assert.equal(questView.some(item => item.chapterId === 'guard'), false)
  } finally { await cleanup(t) }
})

test('买种子到交订单的核心链路仍可工作，且删除附加件后旧快照仍可继续处理', async () => {
  const t = await env({ random: rand([0, 0, 0, 0, 0, 0, 0]) })
  try {
    await writeJson(path.join(t.addonDirPath, 'tea.json'), { schemaVersion: 1, id: 'tea-pack', name: '茶园', version: '1.0.0', enabled: true, priority: 8, starterGrants: [], crops: [crop('green-tea', '青茶', { growMinutes: 10, sellPrice: 18 })], orderTemplates: [{ cropAlias: 'green-tea', qtyMin: 2, qtyMax: 2, coinBonusPerUnit: 4, weight: 1 }] })
    __reloadFarmRegistryForTests('tea')
    const state = getFarmState('farmer')
    buySeeds(state, 'green-tea', 2)
    plantSeed(state, 1, 'green-tea', 1000)
    waterPlots(state, 1, 1500)
    const readyAt = state.plots[0].readyAt
    const harvestResult = harvestPlots(state, 1, readyAt + 1)
    assert.equal(harvestResult.ok, true)
    assert.ok((harvestResult.harvested || []).some(item => item.count >= 1))
    const sellResult = sellCrops(state, 'green-tea', 1)
    assert.equal(sellResult.coinReward, 18)
    state.crops['green-tea'] = { cropAlias: 'green-tea', count: 2, nameSnapshot: '青茶', sellPriceSnapshot: 18 }
    state.orders = [{ slot: 1, cropAlias: 'green-tea', cropNameSnapshot: '青茶', requiredQty: 2, coinReward: 44, favorReward: 2, expiresAt: Date.now() + 60_000 }, ...state.orders.slice(1)]
    await fsp.unlink(path.join(t.addonDirPath, 'tea.json'))
    __reloadFarmRegistryForTests('tea-removed')
    assert.equal(getFarmRegistry().cropList.some(item => item.alias === 'green-tea'), false)
    assert.equal(sellSeeds(state, 'green-tea', 1).coinReward, 4)
    assert.equal(deliverOrder(state, 1, Date.now()).coinReward, 44)
  } finally { await cleanup(t) }
})

test('多作物订单必须一次性交齐，失败不会部分扣除库存', async () => {
  const t = await env()
  try {
    const state = getFarmState('multi-order')
    state.crops.radish = { cropAlias: 'radish', count: 3, nameSnapshot: '白萝卜', sellPriceSnapshot: 6 }
    state.crops.tomato = { cropAlias: 'tomato', count: 1, nameSnapshot: '番茄', sellPriceSnapshot: 6 }
    state.orders = [{
      slot: 1,
      requirements: [
        { cropAlias: 'radish', cropNameSnapshot: '白萝卜', requiredQty: 2 },
        { cropAlias: 'tomato', cropNameSnapshot: '番茄', requiredQty: 2 }
      ],
      coinReward: 32,
      favorReward: 2,
      expiresAt: Date.now() + 60_000
    }, ...state.orders.slice(1)]

    const failed = deliverOrder(state, 1, Date.now())
    assert.equal(failed.ok, false)
    assert.deepEqual(failed.missingRequirements.map(item => item.cropAlias), ['tomato'])
    assert.equal(state.crops.radish.count, 3)
    assert.equal(state.crops.tomato.count, 1)

    state.crops.tomato.count = 2
    const success = deliverOrder(state, 1, Date.now())
    assert.equal(success.ok, true)
    assert.equal(success.order.requirements.length, 2)
    assert.equal(state.crops.radish.count, 1)
    assert.equal(state.crops.tomato, undefined)
  } finally { await cleanup(t) }
})

test('种子支持按 50% 回收，且不会提供经验或卖作物统计', async () => {
  const t = await env()
  try {
    const state = getFarmState('seed-seller')
    state.seeds.radish = {
      cropAlias: 'radish',
      count: 3,
      nameSnapshot: '白萝卜',
      seedNameSnapshot: '白萝卜种子',
      seedPriceSnapshot: 4
    }
    const beforeXp = state.farmXp
    const beforeSellCropUnits = state.stats.sellCropUnits
    const result = sellSeeds(state, 'radish', 'all')
    assert.equal(result.ok, true)
    assert.equal(result.resalePrice, 2)
    assert.equal(result.coinReward, 6)
    assert.equal(state.seeds.radish, undefined)
    assert.equal(state.farmXp, beforeXp)
    assert.equal(state.stats.sellCropUnits, beforeSellCropUnits)
  } finally { await cleanup(t) }
})

test('偷菜遵守访问前置、每日上限、单轮单次与地主保底，宠物可拦截', async () => {
  const t = await env({ random: rand([0.1, 0.1, 0.1]) })
  try {
    const attacker = getFarmState('attacker')
    const target = getFarmState('target')
    setHighLevel(attacker); setHighLevel(target)
    const baseNow = Date.now()
    buyPlot(target, 6, { now: baseNow }); buySeeds(target, 'radish', 1); plantSeed(target, 6, 'radish', baseNow)
    const stealTime = target.plots[5].readyAt + 1
    assert.equal(stealFromFarm(attacker, target, 2002, 6, stealTime).reason, 'visit_required')
    visitFarm(attacker, target, 2002, stealTime)
    buyPet(target, 'nightcat', { now: stealTime }); buyPetFood(target, 'small-feed', 1, { now: stealTime }); feedPet(target, 'small-feed', 1, stealTime)
    assert.equal(stealFromFarm(attacker, target, 2002, 6, stealTime).reason, 'pet_blocked')
    target.pets.nightcat.guardUntil = 0
    const success = stealFromFarm(attacker, target, 2002, 6, stealTime + 1)
    assert.equal(success.ok, true)
    assert.equal(success.stolenCount, 1)
    assert.equal(stealFromFarm(attacker, target, 2002, 6, stealTime + 2).reason, 'already_stolen')
    attacker.dailyStealAttempts = 5
    attacker.dailyStealDayKey = new Date(stealTime + 3).setHours(0, 0, 0, 0)
    assert.equal(stealFromFarm(attacker, target, 2002, 1, stealTime + 3).reason, 'attempt_limit')
  } finally { await cleanup(t) }
})

test('宠物支持购买、切换、买粮、喂食与 48 小时上限', async () => {
  const t = await env()
  try {
    const state = getFarmState('petter')
    setHighLevel(state)
    assert.equal(buyPet(state, 'dog', { now: 0 }).ok, true)
    assert.equal(buyPet(state, 'goose', { now: 0 }).ok, true)
    assert.equal(usePet(state, 'goose', 0).ok, true)
    assert.equal(buyPetFood(state, 'large-feed', 10, { now: 0 }).inventoryCount, 10)
    const feed = feedPet(state, 'large-feed', 10, 0)
    assert.equal(feed.ok, true)
    assert.equal(feed.actualAddedHours, 48)
    assert.equal(state.pets.goose.guardUntil, 48 * 60 * 60 * 1000)
    const questView = getFarmQuestView(state, 0)
    assert.deepEqual(questView.map(item => item.chapterId), ['tutorial'])
    assert.equal(getFarmLevelInfo(state).level >= 20, true)
  } finally { await cleanup(t) }
})

test('热重载成功会更新 registry，失败时保留上一份可用版本', async () => {
  const t = await env({ watchEnabled: true, watchDebounceMs: 30 })
  try {
    await writeJson(path.join(t.addonDirPath, 'corn.json'), { schemaVersion: 1, id: 'corn-pack', name: '玉米包', version: '1.0.0', enabled: true, priority: 9, starterGrants: [], crops: [crop('cornplus', '玉米王')], orderTemplates: [] })
    await waitFor(() => assert.ok(getFarmRegistry().cropList.some(item => item.alias === 'cornplus')))
    const watched = __getFarmConfigForTests().addonDirPath
    const backup = `${watched}.bak`
    fs.renameSync(watched, backup)
    fs.writeFileSync(watched, 'not-a-directory', 'utf8')
    await waitFor(() => { assert.ok(getFarmAddonStatus().lastReloadError); assert.ok(getFarmRegistry().cropList.some(item => item.alias === 'cornplus')) })
    fs.rmSync(watched, { force: true })
    fs.renameSync(backup, watched)
  } finally { await cleanup(t) }
})
