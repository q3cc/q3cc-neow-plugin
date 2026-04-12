import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildCoinLeaderboard,
  buildCoinLeaderboardView,
  buildHelpLines,
  syncUserData
} from '../utils/user-data.js'

function createMockUser(overrides = {}) {
  return {
    uid: 0,
    nickname: '',
    coins: 0,
    favor: 0,
    signCount: 0,
    stamina: 150,
    maxStamina: 150,
    difficulty: 1,
    mlDifficulty: 1,
    mlReplyMode: 'auto',
    wordleDifficulty: 1,
    boomDifficulty: 1,
    adminUntil: 0,
    suCode: '',
    suCodeExpire: 0,
    banUntil: 0,
    lastRecover: Date.now(),
    lastSign: 0,
    registerTime: new Date().toISOString(),
    ...overrides
  }
}

test('syncUserData 会把昵称标准化为单行短文本', () => {
  const user = createMockUser({
    nickname: '  小   喵  \n  '
  })

  syncUserData(user)

  assert.equal(user.nickname, '小 喵')
})

test('syncUserData 会把缺失或非法的密码破译发送方式回填为 auto', () => {
  const missingModeUser = createMockUser({ mlReplyMode: undefined })
  syncUserData(missingModeUser)
  assert.equal(missingModeUser.mlReplyMode, 'auto')

  const invalidModeUser = createMockUser({ mlReplyMode: 'poster' })
  syncUserData(invalidModeUser)
  assert.equal(invalidModeUser.mlReplyMode, 'auto')

  const validModeUser = createMockUser({ mlReplyMode: 'IMAGE' })
  syncUserData(validModeUser)
  assert.equal(validModeUser.mlReplyMode, 'image')
})

test('Star 币排行榜会按金币降序、UID 升序生成名次并优先展示昵称', () => {
  const leaderboard = buildCoinLeaderboard([
    ['30003', createMockUser({ uid: 3, nickname: '阿月', coins: 35 })],
    ['10001', createMockUser({ uid: 1, nickname: '小星星', coins: 80 })],
    ['20002', createMockUser({ uid: 2, nickname: '', coins: 80 })]
  ])

  assert.deepEqual(leaderboard, [
    { userId: '10001', uid: 1, name: '小星星', coins: 80, rank: 1 },
    { userId: '20002', uid: 2, name: 'UID 2', coins: 80, rank: 2 },
    { userId: '30003', uid: 3, name: '阿月', coins: 35, rank: 3 }
  ])
})

test('帮助菜单会展示 Star 币排行榜入口', () => {
  assert.ok(buildHelpLines().includes('/rank - 查看 Star 币排行榜'))
  assert.ok(buildHelpLines().includes('/dict <词语> - 查词/搜索'))
  assert.ok(buildHelpLines().includes('/dict <1-5> - 查看上一轮搜索结果详情'))
  assert.ok(buildHelpLines().includes('/farm - 种田'))
})

test('排行榜会返回前十之外的当前用户信息', () => {
  const users = Array.from({ length: 12 }, (_, index) => [
    String(10000 + index),
    createMockUser({
      uid: index + 1,
      nickname: `用户${index + 1}`,
      coins: 200 - index
    })
  ])

  const leaderboard = buildCoinLeaderboardView(users, {
    limit: 10,
    userId: '10011'
  })

  assert.equal(leaderboard.entries.length, 10)
  assert.deepEqual(leaderboard.currentUser, {
    userId: '10011',
    uid: 12,
    name: '用户12',
    coins: 189,
    rank: 12
  })
})
