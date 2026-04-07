import test from 'node:test'
import assert from 'node:assert/strict'

import {
  filterBlockedWords,
  isBlockedSexualWord,
  normalizeBlockedWord
} from '../utils/blocked-words.js'

test('色情词屏蔽会统一规范化大小写与非字母符号', () => {
  assert.equal(normalizeBlockedWord(' Dick '), 'DICK')
  assert.equal(normalizeBlockedWord('sex-ed'), 'SEXED')
  assert.equal(isBlockedSexualWord('dick'), true)
  assert.equal(isBlockedSexualWord('DiCk'), true)
  assert.equal(isBlockedSexualWord('sex-ed'), true)
  assert.equal(isBlockedSexualWord('logic'), false)
})

test('色情词屏蔽可批量过滤词表', () => {
  assert.deepEqual(
    filterBlockedWords(['APPLE', 'DICKS', 'SPERM', 'WORLD']),
    ['APPLE', 'WORLD']
  )
})
