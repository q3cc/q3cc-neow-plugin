import test from 'node:test'
import assert from 'node:assert/strict'

import {
  DICT_SELECTION_TTL_MS,
  clearPendingDictSelection,
  getPendingDictSelection,
  pickPendingDictSelection,
  setPendingDictSelection
} from '../utils/dict-selection.js'

test('dict搜索结果会按会话和用户隔离缓存', () => {
  const selection = setPendingDictSelection('group:1', '10001', {
    query: '原神',
    entries: [
      { entry: '原神', explain: 'Genshin Impact' },
      { entry: '原神星族', explain: 'Cybele asteroids' }
    ]
  }, 1000)

  assert.deepEqual(selection, {
    query: '原神',
    entries: [
      { entry: '原神', explain: 'Genshin Impact' },
      { entry: '原神星族', explain: 'Cybele asteroids' }
    ],
    createdAt: 1000
  })

  assert.equal(getPendingDictSelection('group:1', '10001', 1000)?.entries.length, 2)
  assert.equal(getPendingDictSelection('group:1', '10002', 1000), null)

  clearPendingDictSelection('group:1', '10001')
})

test('dict搜索结果会在新结果到来时覆盖旧结果', () => {
  setPendingDictSelection('group:2', '10001', {
    query: '原神',
    entries: [
      { entry: '原神', explain: 'Genshin Impact' }
    ]
  }, 1000)

  setPendingDictSelection('group:2', '10001', {
    query: 'game',
    entries: [
      { entry: 'game', explain: 'n. 游戏' },
      { entry: 'games', explain: 'n. 游戏（复数）' }
    ]
  }, 2000)

  assert.deepEqual(getPendingDictSelection('group:2', '10001', 2000), {
    query: 'game',
    entries: [
      { entry: 'game', explain: 'n. 游戏' },
      { entry: 'games', explain: 'n. 游戏（复数）' }
    ],
    createdAt: 2000
  })

  clearPendingDictSelection('group:2', '10001')
})

test('dict搜索结果超时后会失效', () => {
  setPendingDictSelection('group:3', '10001', {
    query: '原神',
    entries: [
      { entry: '原神', explain: 'Genshin Impact' }
    ]
  }, 1000)

  assert.equal(getPendingDictSelection('group:3', '10001', 1000 + DICT_SELECTION_TTL_MS + 1), null)
})

test('dict可按编号读取上一轮搜索结果', () => {
  setPendingDictSelection('group:4', '10001', {
    query: '原神',
    entries: [
      { entry: '原神', explain: 'Genshin Impact' },
      { entry: '原神星族', explain: 'Cybele asteroids' },
      { entry: '厨神', explain: 'Auguste Gusteau' }
    ]
  }, 1000)

  assert.deepEqual(
    pickPendingDictSelection('group:4', '10001', 1, 1000),
    {
      ok: true,
      reason: 'ok',
      index: 1,
      selection: {
        query: '原神',
        entries: [
          { entry: '原神', explain: 'Genshin Impact' },
          { entry: '原神星族', explain: 'Cybele asteroids' },
          { entry: '厨神', explain: 'Auguste Gusteau' }
        ],
        createdAt: 1000
      },
      entry: { entry: '原神', explain: 'Genshin Impact' }
    }
  )

  assert.deepEqual(
    pickPendingDictSelection('group:4', '10001', 4, 1000),
    {
      ok: false,
      reason: 'out_of_range',
      selection: {
        query: '原神',
        entries: [
          { entry: '原神', explain: 'Genshin Impact' },
          { entry: '原神星族', explain: 'Cybele asteroids' },
          { entry: '厨神', explain: 'Auguste Gusteau' }
        ],
        createdAt: 1000
      }
    }
  )

  clearPendingDictSelection('group:4', '10001')
})

test('空搜索结果不会保留可选缓存', () => {
  assert.equal(setPendingDictSelection('group:5', '10001', {
    query: 'asdfghjkl',
    entries: []
  }, 1000), null)

  assert.deepEqual(pickPendingDictSelection('group:5', '10001', 1, 1000), {
    ok: false,
    reason: 'missing'
  })
})
