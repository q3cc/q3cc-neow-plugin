import test from 'node:test'
import assert from 'node:assert/strict'

import { syncUserData } from '../utils/user-data.js'

function createMockUser(overrides = {}) {
  return {
    uid: 1,
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
