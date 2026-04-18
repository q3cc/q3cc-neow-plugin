import fs from 'fs'
import fsp from 'fs/promises'
import path from 'path'
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  FARM_DAILY_TASK_SLOT_COUNT,
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
  getFarmDailyTaskView,
  getFarmLevelInfo,
  getFarmPetView,
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
    assert.equal(registry.petList.find(item => item.alias === 'raven').guardBaseHours, 4)
    assert.equal(registry.petList.find(item => item.alias === 'raven').guardBonusPercent, 0)
    assert.equal(registry.petList.find(item => item.alias === 'raven').fatigueGainPerHour, 8)
    assert.equal(registry.petFoodList.find(item => item.alias === 'snack').tier, 1)
    assert.equal(registry.petFoodList.find(item => item.alias === 'snack').xpReward, 1)
    assert.equal(registry.petFoodList.find(item => item.alias === 'snack').fatigueRecovery, 3)
    assert.ok(registry.mainQuestChapterList.some(item => item.id === 'miniquest'))
    assert.equal(registry.orderTemplates.find(item => item.addonId === 'tea-pack').requirements.length, 1)
    assert.equal(registry.orderTemplates.find(item => item.addonId === 'combo-pack').requirements.length, 2)
    assert.ok(status.skippedAddons.some(item => item.reason.includes('ghost')))
    assert.ok(status.skippedAddons.some(item => item.id === 'tea-pack' || item.source.includes('dup.json')))
  } finally { await cleanup(t) }
})

test('旧存档会迁移到 15 地块、Lv20、教程完成状态与新宠物字段', async () => {
  const t = await env({ seedData: { legacy: { createdAt: '2026-01-01T00:00:00.000Z', starterGrantApplied: true, plots: Array.from({ length: 4 }, (_, i) => ({ plotId: i + 1, cropAlias: '', readyAt: 0 })), seeds: { radish: { cropAlias: 'radish', count: 3, nameSnapshot: '白萝卜', seedNameSnapshot: '白萝卜种子', seedPriceSnapshot: 4 } }, crops: {}, pets: { dog: { petAlias: 'dog', nameSnapshot: '看家狗', guardInterceptPercentSnapshot: 35, boughtAt: 123, guardUntil: 456 } }, petFoods: { 'small-feed': { foodAlias: 'small-feed', count: 2, nameSnapshot: '小包宠物粮', guardHoursSnapshot: 2, priceSnapshot: 60 } }, activePetAlias: 'dog', orders: [] } } })
  try {
    const state = getFarmState('legacy')
    assert.equal(state.plots.length, 15)
    assert.equal(state.plots[4].owned, true)
    assert.equal(state.plots[5].owned, false)
    assert.equal(state.farmLevel, 20)
    assert.ok(state.mainQuests.tutorial.completedAt > 0)
    assert.equal(state.seeds.radish.count, 3)
    assert.equal(state.pets.dog.level, 1)
    assert.equal(state.pets.dog.xp, 0)
    assert.equal(state.pets.dog.fatigue, 0)
    assert.equal(state.pets.dog.guardBaseHoursSnapshot, 4)
    assert.equal(state.pets.dog.guardBonusPercentSnapshot, 0)
    assert.equal(state.pets.dog.fatigueGainPerHourSnapshot, 8)
    assert.equal(state.petFoods['small-feed'].tierSnapshot, 1)
    assert.equal(state.petFoods['small-feed'].xpRewardSnapshot, 2)
    assert.equal(state.petFoods['small-feed'].fatigueRecoverySnapshot, 6)
  } finally { await cleanup(t) }
})

test('坏掉的农场存档不会被当成新号重建并覆盖', async () => {
  const t = await env()
  try {
    await writeJson(t.farmDataPath, {
      broken: {
        starterGrantApplied: true,
        seeds: {
          radish: {
            cropAlias: 'radish',
            count: 7,
            nameSnapshot: '白萝卜',
            seedNameSnapshot: '白萝卜种子',
            seedPriceSnapshot: 4
          }
        }
      }
    })
    await fsp.writeFile(t.farmDataPath, '{broken', 'utf8')
    __configureFarmForTests({ addonDirPath: t.addonDirPath, farmDataPath: t.farmDataPath, coreAddonPath, watchEnabled: false })

    assert.throws(() => getFarmState('broken'), /读取 farm 存档失败/)
    assert.equal(await fsp.readFile(t.farmDataPath, 'utf8'), '{broken')
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

test('支持用 1-5 范围一次性连续播种，且会一次扣除种子与体力成本', async () => {
  const t = await env()
  try {
    const state = getFarmState('range-planter')
    state.seeds = {}
    buySeeds(state, 'radish', 5)
    const result = plantSeed(state, '1-5', 'radish', 0)
    assert.equal(result.ok, true)
    assert.equal(result.plantCount, 5)
    assert.equal(result.staminaCost, 25)
    assert.equal(state.seeds.radish, undefined)
    assert.equal(state.stats.plantCount, 5)
    assert.deepEqual(result.plots.map(plot => plot.plotId), [1, 2, 3, 4, 5])
    assert.equal(result.plots.every(plot => plot.cropAlias === 'radish'), true)
  } finally { await cleanup(t) }
})

test('连续播种遇到空位不足种子或中途被占用时不会部分播种', async () => {
  const t = await env()
  try {
    const state = getFarmState('range-planter-guard')
    state.seeds = {}
    buySeeds(state, 'radish', 4)
    const notEnoughSeeds = plantSeed(state, '1-5', 'radish', 0, { preview: true })
    assert.equal(notEnoughSeeds.ok, false)
    assert.equal(notEnoughSeeds.reason, 'seed_missing')
    assert.equal(notEnoughSeeds.requiredSeeds, 5)
    assert.equal(notEnoughSeeds.availableSeeds, 4)

    buySeeds(state, 'radish', 1)
    plantSeed(state, 3, 'radish', 0)
    const occupied = plantSeed(state, '1-5', 'radish', 1, { preview: true })
    assert.equal(occupied.ok, false)
    assert.equal(occupied.reason, 'plot_occupied')
    assert.equal(occupied.plot.plotId, 3)
    assert.equal(state.plots[0].cropAlias, '')
    assert.equal(state.plots[1].cropAlias, '')
    assert.equal(state.plots[2].cropAlias, 'radish')
    assert.equal(state.plots[3].cropAlias, '')
    assert.equal(state.plots[4].cropAlias, '')
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

test('每日任务会在首次同步时补满 3 条，并在跨天后重置进度', async () => {
  const t = await env({ random: rand([0, 0.2, 0.4, 0.6, 0.8, 0.1]) })
  try {
    const baseNow = Date.UTC(2026, 0, 2, 12, 0, 0)
    const state = getFarmState('daily-reset')
    const firstView = getFarmDailyTaskView(state, baseNow)
    assert.equal(firstView.totalCount, FARM_DAILY_TASK_SLOT_COUNT)
    assert.equal(firstView.tasks.length, FARM_DAILY_TASK_SLOT_COUNT)

    state.dailyStats.openFarmCount = 5
    state.dailyStats.buySeedCount = 5
    state.dailyStats.plantCount = 5
    state.dailyStats.waterCount = 5
    state.dailyStats.harvestUnits = 5
    state.dailyStats.sellCropUnits = 5
    state.dailyStats.deliverOrderCount = 5
    state.dailyTasks[0].completedAt = 123

    const nextDayNow = firstView.dayKey + (24 * 60 * 60 * 1000) + 1000
    const nextView = getFarmDailyTaskView(state, nextDayNow)
    assert.equal(nextView.totalCount, FARM_DAILY_TASK_SLOT_COUNT)
    assert.notEqual(nextView.dayKey, firstView.dayKey)
    assert.equal(state.dailyStats.openFarmCount, 0)
    assert.equal(state.dailyStats.buySeedCount, 0)
    assert.equal(state.dailyStats.plantCount, 0)
    assert.equal(state.dailyStats.waterCount, 0)
    assert.equal(state.dailyStats.harvestUnits, 0)
    assert.equal(state.dailyStats.sellCropUnits, 0)
    assert.equal(state.dailyStats.deliverOrderCount, 0)
    assert.equal(nextView.completedCount, 0)
    assert.equal(nextView.tasks.every(task => task.progress === 0 && task.completed === false), true)
  } finally { await cleanup(t) }
})

test('每日任务完成奖励只会发放一次', async () => {
  const t = await env({ random: rand([0, 0.2, 0.4, 0.6, 0.8]) })
  try {
    const baseNow = Date.UTC(2026, 0, 2, 12, 0, 0)
    const state = getFarmState('daily-once')
    getFarmDailyTaskView(state, baseNow)
    state.mainQuests.tutorial.currentStep = 1
    state.mainQuests.tutorial.progress = 0
    state.dailyTasks = [{
      templateId: 'open-farm',
      type: 'open_farm',
      title: '打开一次 /farm',
      target: 1,
      progress: 0,
      coinReward: 20,
      xpReward: 5,
      completedAt: 0
    }]

    const first = recordFarmAction(state, 'open_farm', baseNow)
    assert.equal(first.questCoinReward, 0)
    assert.equal(first.dailyCoinReward, 20)
    assert.equal(first.farmXpGained, 5)
    assert.equal(first.dailyProgress.taskCompletions.length, 1)
    assert.equal(state.dailyTasks[0].completedAt, baseNow)

    const second = recordFarmAction(state, 'open_farm', baseNow + 1)
    assert.equal(second.dailyCoinReward, 0)
    assert.equal(second.dailyProgress.taskCompletions.length, 0)
    assert.equal(state.dailyTasks[0].completedAt, baseNow)
  } finally { await cleanup(t) }
})

test('每日统计会随着买种子到交订单的动作推进', async () => {
  const t = await env()
  try {
    const state = getFarmState('daily-progress')
    buySeeds(state, 'radish', 2)
    assert.equal(state.dailyStats.buySeedCount, 2)

    plantSeed(state, '1-2', 'radish', 0)
    assert.equal(state.dailyStats.plantCount, 2)

    waterPlots(state, 'all', 1)
    assert.equal(state.dailyStats.waterCount, 2)

    const readyAt = Math.max(state.plots[0].readyAt, state.plots[1].readyAt)
    harvestPlots(state, 'all', readyAt + 1)
    assert.equal(state.dailyStats.harvestUnits, 2)

    sellCrops(state, 'radish', 1)
    assert.equal(state.dailyStats.sellCropUnits, 1)

    state.orders = [{
      slot: 1,
      requirements: [
        { cropAlias: 'radish', cropNameSnapshot: '白萝卜', requiredQty: 1 }
      ],
      coinReward: 12,
      favorReward: 1,
      expiresAt: Date.now() + 60_000
    }, ...state.orders.slice(1)]
    deliverOrder(state, 1, Date.now())
    assert.equal(state.dailyStats.deliverOrderCount, 1)
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

test('宠物支持购买、切换、买粮、喂食成长与 48 小时上限', async () => {
  const t = await env()
  try {
    const state = getFarmState('petter')
    setHighLevel(state)
    const firstPet = buyPet(state, 'dog', { now: 0 })
    assert.equal(firstPet.ok, true)
    assert.equal(firstPet.initialGuardHours, 4)
    assert.equal(state.pets.dog.guardUntil, 4 * 60 * 60 * 1000)
    assert.equal(buyPet(state, 'goose', { now: 0 }).ok, true)
    assert.equal(usePet(state, 'goose', 0).ok, true)
    assert.equal(buyPetFood(state, 'large-feed', 10, { now: 0 }).inventoryCount, 10)
    const feed = feedPet(state, 'large-feed', 10, 0)
    assert.equal(feed.ok, true)
    assert.equal(feed.actualAddedHours, 48)
    assert.equal(feed.usedCount, 4)
    assert.equal(feed.petLevelAfter, 3)
    assert.equal(feed.petXpGained, 40)
    assert.equal(state.pets.goose.guardUntil, 48 * 60 * 60 * 1000)
    assert.equal(state.petFoods['large-feed'].count, 6)
    assert.equal(state.pets.goose.level, 3)
    assert.equal(state.pets.goose.fatigue, 0)
    const questView = getFarmQuestView(state, 0)
    assert.deepEqual(questView.map(item => item.chapterId), ['tutorial'])
    assert.equal(getFarmLevelInfo(state).level >= 20, true)
  } finally { await cleanup(t) }
})

test('宠物看家成长、休息恢复与小时余量会正确累计', async () => {
  const t = await env()
  try {
    const state = getFarmState('pet-cycle')
    setHighLevel(state)
    buyPet(state, 'dog', { now: 0 })
    buyPet(state, 'goose', { now: 0 })

    syncFarmState(state, 30 * 60 * 1000)
    assert.equal(state.pets.dog.xp, 0)
    assert.equal(state.pets.dog.fatigue, 0)
    assert.equal(state.pets.dog.activeProgressMs, 30 * 60 * 1000)

    syncFarmState(state, 60 * 60 * 1000)
    assert.equal(state.pets.dog.xp, 1)
    assert.equal(state.pets.dog.level, 1)
    assert.equal(state.pets.dog.fatigue, 9)
    assert.equal(state.pets.dog.activeProgressMs, 0)

    usePet(state, 'goose', 60 * 60 * 1000)
    syncFarmState(state, 90 * 60 * 1000)
    assert.equal(state.pets.dog.fatigue, 9)
    assert.equal(state.pets.dog.restProgressMs, 30 * 60 * 1000)

    syncFarmState(state, 120 * 60 * 1000)
    assert.equal(state.pets.dog.fatigue, 0)
    assert.equal(state.pets.dog.restProgressMs, 0)
  } finally { await cleanup(t) }
})

test('宠物拦截率会受等级和疲劳影响', async () => {
  const t = await env()
  try {
    const state = getFarmState('pet-view')
    setHighLevel(state)
    buyPet(state, 'dog', { now: 0 })
    state.pets.dog.guardUntil = 10 * 60 * 60 * 1000

    state.pets.dog.xp = 0
    state.pets.dog.level = 1
    state.pets.dog.fatigue = 100
    let petView = getFarmPetView(state, 0)
    assert.equal(petView.activePet.effectiveInterceptPercent, 25)

    state.pets.dog.xp = 70
    state.pets.dog.level = 5
    state.pets.dog.fatigue = 0
    petView = getFarmPetView(state, 0)
    assert.equal(petView.activePet.effectiveInterceptPercent, 47)
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
