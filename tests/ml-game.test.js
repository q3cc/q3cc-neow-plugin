import test from 'node:test'
import assert from 'node:assert/strict'

import {
  ML_FORCE_TEXT_DIFFICULTY,
  ML_REPLY_MODES,
  normalizeMlReplyMode,
  resolveMlReplyMode
} from '../utils/ml-game.js'

test('密码破译发送方式会规范化为 auto image text 三种模式', () => {
  assert.deepEqual(Object.keys(ML_REPLY_MODES), ['auto', 'image', 'text'])
  assert.equal(normalizeMlReplyMode('auto'), 'auto')
  assert.equal(normalizeMlReplyMode('IMAGE'), 'image')
  assert.equal(normalizeMlReplyMode(' text '), 'text')
})

test('密码破译发送方式缺失或非法时会回退到 auto', () => {
  assert.equal(normalizeMlReplyMode(), 'auto')
  assert.equal(normalizeMlReplyMode(''), 'auto')
  assert.equal(normalizeMlReplyMode('gif'), 'auto')
})

test('密码破译发送方式在另类极限下会强制改为文字', () => {
  assert.equal(ML_FORCE_TEXT_DIFFICULTY, 4)
  assert.equal(resolveMlReplyMode('auto', 1), 'auto')
  assert.equal(resolveMlReplyMode('image', 2), 'image')
  assert.equal(resolveMlReplyMode('text', 3), 'text')
  assert.equal(resolveMlReplyMode('auto', 4), 'text')
  assert.equal(resolveMlReplyMode('image', 4), 'text')
  assert.equal(resolveMlReplyMode('text', 4), 'text')
})
