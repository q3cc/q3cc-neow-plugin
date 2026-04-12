import fs from 'fs'
import fsp from 'fs/promises'
import path from 'path'
import test from 'node:test'
import assert from 'node:assert/strict'

import {
  __configureFarmForTests,
  __getFarmConfigForTests,
  __getFarmFlushPromiseForTests,
  __reloadFarmRegistryForTests,
  __stopFarmWatcherForTests,
  buySeeds,
  deliverOrder,
  getFarmAddonStatus,
  getFarmRegistry,
  getFarmState,
  harvestPlots,
  plantSeed,
  sellCrops,
  waterPlots
} from '../utils/farm-game.js'

const coreAddonPath = path.join(process.cwd(), 'resources/farm-core-addon.json')

function createSequenceRandom(values) {
  let index = 0

  return () => {
    const value = values[index]
    index = Math.min(index + 1, values.length - 1)
    return value
  }
}

async function createFarmTestEnv(options = {}) {
  const rootDir = await fsp.mkdtemp(path.join('/tmp', 'farm-game-'))
  const addonDirPath = path.join(rootDir, 'addons')
  const farmDataPath = path.join(rootDir, 'farm-state.json')
  await fsp.mkdir(addonDirPath, { recursive: true })

  __configureFarmForTests({
    addonDirPath,
    farmDataPath,
    coreAddonPath,
    watchEnabled: options.watchEnabled ?? false,
    watchDebounceMs: options.watchDebounceMs ?? 20,
    random: options.random
  })

  return {
    rootDir,
    addonDirPath,
    farmDataPath
  }
}

async function cleanupFarmTestEnv(rootDir) {
  __stopFarmWatcherForTests()
  await __getFarmFlushPromiseForTests()
  await fsp.rm(rootDir, { recursive: true, force: true })
}

async function waitForCondition(assertion, timeoutMs = 1500) {
  const startedAt = Date.now()

  while (Date.now() - startedAt <= timeoutMs) {
    try {
      assertion()
      return
    } catch {
      await new Promise(resolve => setTimeout(resolve, 25))
    }
  }

  assertion()
}

test('farm core 包会提供基础作物、订单与新手种子', async () => {
  const env = await createFarmTestEnv({
    random: createSequenceRandom([0, 0, 0, 0, 0, 0, 0, 0])
  })

  try {
    const registry = getFarmRegistry()
    assert.equal(registry.addons.length, 1)
    assert.ok(registry.cropList.some(crop => crop.alias === 'radish'))
    assert.ok(registry.cropList.some(crop => crop.alias === 'tomato'))

    const state = getFarmState('10001')
    assert.equal(state.plots.length, 4)
    assert.equal(state.seeds.radish.count, 4)
    assert.equal(state.seeds.tomato.count, 2)
    assert.equal(state.orders.length, 3)
  } finally {
    await cleanupFarmTestEnv(env.rootDir)
  }
})

test('外部附加件会被扫描加载，重复 id 与冲突 alias 的包会被跳过', async () => {
  const env = await createFarmTestEnv()

  try {
    await fsp.writeFile(path.join(env.addonDirPath, 'tea.json'), JSON.stringify({
      schemaVersion: 1,
      id: 'tea-pack',
      name: '茶园包',
      version: '1.0.0',
      enabled: true,
      priority: 10,
      starterGrants: [],
      crops: [
        {
          alias: 'tea',
          name: '茶叶',
          seedName: '茶叶苗',
          seedPrice: 12,
          growMinutes: 50,
          plantStamina: 5,
          waterStamina: 2,
          waterBaseReductionPercent: 25,
          harvestYield: 1,
          sellPrice: 18,
          orderFavorReward: 2
        }
      ],
      orderTemplates: [
        {
          cropAlias: 'tea',
          qtyMin: 2,
          qtyMax: 3,
          coinBonusPerUnit: 4,
          weight: 3
        }
      ]
    }, null, 2), 'utf8')
    await fsp.writeFile(path.join(env.addonDirPath, 'dup-id.json'), JSON.stringify({
      schemaVersion: 1,
      id: 'tea-pack',
      name: '重复 ID 包',
      version: '1.0.0',
      enabled: true,
      priority: 5,
      starterGrants: [],
      crops: [],
      orderTemplates: []
    }, null, 2), 'utf8')
    await fsp.writeFile(path.join(env.addonDirPath, 'alias-conflict.json'), JSON.stringify({
      schemaVersion: 1,
      id: 'bad-alias-pack',
      name: '冲突包',
      version: '1.0.0',
      enabled: true,
      priority: 4,
      starterGrants: [],
      crops: [
        {
          alias: 'radish',
          name: '假的白萝卜',
          seedName: '假的白萝卜种子',
          seedPrice: 1,
          growMinutes: 1,
          plantStamina: 1,
          waterStamina: 1,
          waterBaseReductionPercent: 10,
          harvestYield: 1,
          sellPrice: 1,
          orderFavorReward: 1
        }
      ],
      orderTemplates: []
    }, null, 2), 'utf8')

    const reloadResult = __reloadFarmRegistryForTests('manual-test')
    assert.equal(reloadResult.ok, true)

    const registry = getFarmRegistry()
    const status = getFarmAddonStatus()

    assert.ok(registry.cropList.some(crop => crop.alias === 'tea'))
    assert.ok(status.loadedAddons.some(addon => addon.id === 'tea-pack'))
    assert.ok(status.skippedAddons.some(item => item.reason.includes('重复')))
    assert.ok(status.skippedAddons.some(item => item.reason.includes('冲突')))
  } finally {
    await cleanupFarmTestEnv(env.rootDir)
  }
})

test('无效订单引用只会跳过对应模板，不会污染其他已加载内容', async () => {
  const env = await createFarmTestEnv()

  try {
    await fsp.writeFile(path.join(env.addonDirPath, 'orders.json'), JSON.stringify({
      schemaVersion: 1,
      id: 'order-pack',
      name: '订单附加包',
      version: '1.0.0',
      enabled: true,
      priority: 3,
      starterGrants: [],
      crops: [],
      orderTemplates: [
        {
          cropAlias: 'radish',
          qtyMin: 3,
          qtyMax: 5,
          coinBonusPerUnit: 9,
          weight: 2
        },
        {
          cropAlias: 'missing-crop',
          qtyMin: 1,
          qtyMax: 2,
          coinBonusPerUnit: 1,
          weight: 1
        }
      ]
    }, null, 2), 'utf8')

    __reloadFarmRegistryForTests('order-template-test')
    const registry = getFarmRegistry()
    const status = getFarmAddonStatus()

    assert.ok(registry.orderTemplates.some(template => template.cropAlias === 'radish' && template.coinBonusPerUnit === 9))
    assert.ok(!registry.orderTemplates.some(template => template.cropAlias === 'missing-crop'))
    assert.ok(status.skippedAddons.some(item => item.reason.includes('missing-crop')))
  } finally {
    await cleanupFarmTestEnv(env.rootDir)
  }
})

test('种子购买、播种、浇水、收获、卖出与交订单会按照快照规则工作', async () => {
  const env = await createFarmTestEnv({
    random: createSequenceRandom([
      0, 0, 0, 0, 0, 0,
      0.2, 0.1, 0.3, 0.1
    ])
  })

  try {
    const state = getFarmState('20001')
    const buyResult = buySeeds(state, 'pumpkin', 2)
    assert.equal(buyResult.ok, true)
    assert.equal(state.seeds.pumpkin.count, 2)

    const plantResult = plantSeed(state, 1, 'pumpkin', 1_000)
    assert.equal(plantResult.ok, true)
    assert.equal(state.plots[0].cropAlias, 'pumpkin')

    const waterPreview = waterPlots(state, 1, 1_500, { preview: true })
    assert.equal(waterPreview.ok, true)
    assert.equal(waterPreview.staminaCost, 2)

    const waterResult = waterPlots(state, 1, 1_500)
    assert.equal(waterResult.ok, true)
    assert.equal(state.plots[0].watered, true)
    assert.ok(state.plots[0].readyAt < plantResult.readyAt)

    const harvestResult = harvestPlots(state, 1, state.plots[0].readyAt + 1)
    assert.equal(harvestResult.ok, true)
    assert.equal(state.crops.pumpkin.count, 1)
    assert.equal(state.plots[0].cropAlias, '')

    const sellResult = sellCrops(state, 'pumpkin', 1)
    assert.equal(sellResult.ok, true)
    assert.equal(sellResult.coinReward, 22)
    assert.equal(state.crops.pumpkin, undefined)

    state.crops.radish = {
      cropAlias: 'radish',
      count: 5,
      nameSnapshot: '白萝卜',
      sellPriceSnapshot: 6
    }
    state.orders = [
      {
        slot: 1,
        cropAlias: 'radish',
        cropNameSnapshot: '白萝卜',
        requiredQty: 3,
        coinReward: 24,
        favorReward: 1,
        expiresAt: Date.now() + 60_000
      },
      ...state.orders.slice(1)
    ]
    state.orderBoardExpiresAt = state.orders[0].expiresAt

    const deliverResult = deliverOrder(state, 1, Date.now())
    assert.equal(deliverResult.ok, true)
    assert.equal(deliverResult.coinReward, 24)
    assert.equal(deliverResult.favorReward, 1)
    assert.equal(state.crops.radish.count, 2)
    assert.equal(state.orders[0].slot, 1)
    assert.equal(state.orders[0].expiresAt, state.orderBoardExpiresAt)
  } finally {
    await cleanupFarmTestEnv(env.rootDir)
  }
})

test('附加件被删除后，旧地块、背包和订单仍可继续处理', async () => {
  const env = await createFarmTestEnv({
    random: createSequenceRandom([0.2, 0, 0, 0, 0])
  })

  try {
    await fsp.writeFile(path.join(env.addonDirPath, 'tea.json'), JSON.stringify({
      schemaVersion: 1,
      id: 'tea-pack',
      name: '茶园包',
      version: '1.0.0',
      enabled: true,
      priority: 10,
      starterGrants: [],
      crops: [
        {
          alias: 'tea',
          name: '茶叶',
          seedName: '茶叶苗',
          seedPrice: 12,
          growMinutes: 10,
          plantStamina: 5,
          waterStamina: 2,
          waterBaseReductionPercent: 25,
          harvestYield: 1,
          sellPrice: 18,
          orderFavorReward: 2
        }
      ],
      orderTemplates: [
        {
          cropAlias: 'tea',
          qtyMin: 2,
          qtyMax: 2,
          coinBonusPerUnit: 4,
          weight: 1
        }
      ]
    }, null, 2), 'utf8')
    __reloadFarmRegistryForTests('load-tea')

    const state = getFarmState('30001')
    buySeeds(state, 'tea', 2)
    plantSeed(state, 1, 'tea', 1_000)
    state.crops.tea = {
      cropAlias: 'tea',
      count: 2,
      nameSnapshot: '茶叶',
      sellPriceSnapshot: 18
    }
    state.orders = [
      {
        slot: 1,
        cropAlias: 'tea',
        cropNameSnapshot: '茶叶',
        requiredQty: 2,
        coinReward: 44,
        favorReward: 2,
        expiresAt: Date.now() + 60_000
      },
      ...state.orders.slice(1)
    ]
    state.orderBoardExpiresAt = state.orders[0].expiresAt

    await fsp.unlink(path.join(env.addonDirPath, 'tea.json'))
    __reloadFarmRegistryForTests('remove-tea')

    assert.equal(getFarmRegistry().cropList.some(crop => crop.alias === 'tea'), false)

    const waterResult = waterPlots(state, 1, 2_000)
    assert.equal(waterResult.ok, true)

    const harvestResult = harvestPlots(state, 1, state.plots[0].readyAt + 1)
    assert.equal(harvestResult.ok, true)
    assert.ok(state.crops.tea.count >= 1)

    const sellResult = sellCrops(state, 'tea', 1)
    assert.equal(sellResult.ok, true)
    assert.equal(sellResult.coinReward, 18)

    state.crops.tea = {
      cropAlias: 'tea',
      count: 2,
      nameSnapshot: '茶叶',
      sellPriceSnapshot: 18
    }
    const deliverResult = deliverOrder(state, 1, Date.now())
    assert.equal(deliverResult.ok, true)
    assert.equal(deliverResult.coinReward, 44)
  } finally {
    await cleanupFarmTestEnv(env.rootDir)
  }
})

test('farm 热重载成功时会自动更新 registry', async () => {
  const env = await createFarmTestEnv({
    watchEnabled: true,
    watchDebounceMs: 30
  })

  try {
    const beforeReloadAt = getFarmAddonStatus().lastSuccessfulReloadAt

    await fsp.writeFile(path.join(env.addonDirPath, 'corn.json'), JSON.stringify({
      schemaVersion: 1,
      id: 'corn-pack',
      name: '玉米包',
      version: '1.0.0',
      enabled: true,
      priority: 8,
      starterGrants: [],
      crops: [
        {
          alias: 'corn',
          name: '玉米',
          seedName: '玉米种子',
          seedPrice: 9,
          growMinutes: 20,
          plantStamina: 5,
          waterStamina: 2,
          waterBaseReductionPercent: 25,
          harvestYield: 1,
          sellPrice: 14,
          orderFavorReward: 2
        }
      ],
      orderTemplates: []
    }, null, 2), 'utf8')

    await waitForCondition(() => {
      const status = getFarmAddonStatus()
      const registry = getFarmRegistry()
      assert.ok(status.lastSuccessfulReloadAt >= beforeReloadAt)
      assert.ok(registry.cropList.some(crop => crop.alias === 'corn'))
    })
  } finally {
    await cleanupFarmTestEnv(env.rootDir)
  }
})

test('farm 热重载遇到致命错误时会保留上一份可用 registry', async () => {
  const env = await createFarmTestEnv({
    watchEnabled: true,
    watchDebounceMs: 30
  })

  try {
    await fsp.writeFile(path.join(env.addonDirPath, 'corn.json'), JSON.stringify({
      schemaVersion: 1,
      id: 'corn-pack',
      name: '玉米包',
      version: '1.0.0',
      enabled: true,
      priority: 8,
      starterGrants: [],
      crops: [
        {
          alias: 'corn',
          name: '玉米',
          seedName: '玉米种子',
          seedPrice: 9,
          growMinutes: 20,
          plantStamina: 5,
          waterStamina: 2,
          waterBaseReductionPercent: 25,
          harvestYield: 1,
          sellPrice: 14,
          orderFavorReward: 2
        }
      ],
      orderTemplates: []
    }, null, 2), 'utf8')

    await waitForCondition(() => {
      assert.ok(getFarmRegistry().cropList.some(crop => crop.alias === 'corn'))
    })

    const watchedAddonDirPath = __getFarmConfigForTests().addonDirPath
    const backupDirPath = `${watchedAddonDirPath}.bak`
    fs.renameSync(watchedAddonDirPath, backupDirPath)
    fs.writeFileSync(watchedAddonDirPath, 'not-a-directory', 'utf8')

    await waitForCondition(() => {
      const status = getFarmAddonStatus()
      assert.ok(status.lastReloadError)
      assert.ok(getFarmRegistry().cropList.some(crop => crop.alias === 'corn'))
    })

    fs.rmSync(watchedAddonDirPath, { force: true })
    fs.renameSync(backupDirPath, watchedAddonDirPath)
  } finally {
    await cleanupFarmTestEnv(env.rootDir)
  }
})
