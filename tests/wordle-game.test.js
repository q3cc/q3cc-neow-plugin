import fs from 'node:fs'
import test from 'node:test'
import assert from 'node:assert/strict'

import {
  evaluateWordleGuess,
  getWordleAnswerPool,
  getRandomWordleWord,
  isValidWordleWord,
  normalizeWordleGuess
} from '../utils/wordle-game.js'

const answerWordsPath = new URL('../resources/wordle-words.json', import.meta.url)
const allowedGuessWordsPath = new URL('../resources/wordle-allowed-guesses.json', import.meta.url)
const gaokaoWordsPath = new URL('../resources/wordle-cn-gaokao-words.json', import.meta.url)
const cet4WordsPath = new URL('../resources/wordle-cn-cet4-words.json', import.meta.url)
const cet6WordsPath = new URL('../resources/wordle-cn-cet6-words.json', import.meta.url)
const answerWordList = JSON.parse(fs.readFileSync(answerWordsPath, 'utf8'))
const allowedGuessWordList = JSON.parse(fs.readFileSync(allowedGuessWordsPath, 'utf8'))
const gaokaoWordList = JSON.parse(fs.readFileSync(gaokaoWordsPath, 'utf8'))
const cet4ExtraWordList = JSON.parse(fs.readFileSync(cet4WordsPath, 'utf8'))
const cet6ExtraWordList = JSON.parse(fs.readFileSync(cet6WordsPath, 'utf8'))

test('wordle答案词库与合法猜测词库都保持大写、五字母且无重复', () => {
  assert.ok(answerWordList.length >= 2000)
  assert.ok(allowedGuessWordList.length >= 10000)
  assert.equal(answerWordList.length, new Set(answerWordList).size)
  assert.equal(allowedGuessWordList.length, new Set(allowedGuessWordList).size)
  assert.ok(answerWordList.every(word => /^[A-Z]{5}$/.test(word)))
  assert.ok(allowedGuessWordList.every(word => /^[A-Z]{5}$/.test(word)))
})

test('wordle国内词库按高考基础 + 四六级附加分层且无重复', () => {
  assert.ok(gaokaoWordList.length >= 600)
  assert.ok(cet4ExtraWordList.length >= 200)
  assert.ok(cet6ExtraWordList.length >= 150)
  assert.equal(gaokaoWordList.length, new Set(gaokaoWordList).size)
  assert.equal(cet4ExtraWordList.length, new Set(cet4ExtraWordList).size)
  assert.equal(cet6ExtraWordList.length, new Set(cet6ExtraWordList).size)
  assert.equal(cet4ExtraWordList.some(word => gaokaoWordList.includes(word)), false)
  assert.equal(cet6ExtraWordList.some(word => gaokaoWordList.includes(word) || cet4ExtraWordList.includes(word)), false)
})

test('wordle辅助方法会规范化并校验答案词与合法猜测词', () => {
  assert.equal(normalizeWordleGuess('cigar'), 'CIGAR')
  assert.equal(isValidWordleWord('cigar'), true)
  assert.equal(answerWordList.includes('AAHED'), false)
  assert.equal(allowedGuessWordList.includes('AAHED'), true)
  assert.equal(isValidWordleWord('aahed'), true)
  assert.equal(isValidWordleWord('logic'), true)
  assert.equal(isValidWordleWord('quart'), true)
  assert.equal(isValidWordleWord('zonal'), true)
  assert.equal(isValidWordleWord('meow'), false)

  const randomWord = getRandomWordleWord(3)
  assert.equal(answerWordList.includes(randomWord), true)
})

test('wordle按难度使用高考基础库和四六级附加库', () => {
  const difficulty0Pool = getWordleAnswerPool(0)
  const difficulty1Pool = getWordleAnswerPool(1)
  const difficulty2Pool = getWordleAnswerPool(2)
  const difficulty3Pool = getWordleAnswerPool(3)

  assert.equal(difficulty0Pool.length, gaokaoWordList.length)
  assert.equal(difficulty1Pool.length, gaokaoWordList.length + cet4ExtraWordList.length)
  assert.equal(difficulty2Pool.length, gaokaoWordList.length + cet4ExtraWordList.length + cet6ExtraWordList.length)
  assert.deepEqual(difficulty3Pool.slice(0, 20), answerWordList.slice(0, 20))
  assert.equal(getRandomWordleWord(0, () => 0), gaokaoWordList[0])
  assert.equal(difficulty1Pool.includes(cet4ExtraWordList[0]), true)
  assert.equal(difficulty2Pool.includes(cet6ExtraWordList[0]), true)
})

test('重复字母命中判定会优先消耗未使用答案字母', () => {
  assert.deepEqual(
    evaluateWordleGuess('APPLE', 'PAPAL'),
    ['🟠', '🟠', '🟢', '🔴', '🟠']
  )
})
