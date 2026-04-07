import fs from 'fs'
import { filterBlockedWords, isBlockedSexualWord } from './blocked-words.js'

export const WORDLE_DIFFICULTIES = {
  0: {
    name: '简单',
    desc: '8 次机会, 无时间限制',
    wordSource: '高考基础词库',
    stamina: 10,
    maxAttempts: 8,
    timeLimit: 0,
    coinRange: [1, 3],
    favorRange: [1, 2],
    penaltyRange: [1, 2]
  },
  1: {
    name: '普通',
    desc: '6 次机会, 180 秒时间',
    wordSource: '高考基础 + 四级附加',
    stamina: 15,
    maxAttempts: 6,
    timeLimit: 180,
    coinRange: [2, 5],
    favorRange: [1, 3],
    penaltyRange: [2, 4]
  },
  2: {
    name: '困难',
    desc: '5 次机会, 120 秒时间',
    wordSource: '高考基础 + 四级附加 + 六级附加',
    stamina: 20,
    maxAttempts: 5,
    timeLimit: 120,
    coinRange: [3, 7],
    favorRange: [2, 5],
    penaltyRange: [3, 5]
  },
  3: {
    name: '极限',
    desc: '4 次机会, 60 秒时间',
    wordSource: '原版 Wordle 词库',
    stamina: 25,
    maxAttempts: 4,
    timeLimit: 60,
    coinRange: [5, 10],
    favorRange: [3, 7],
    penaltyRange: [4, 6]
  }
}

const wordleGames = new Map()
const answerWordsPath = new URL('../resources/wordle-words.json', import.meta.url)
const allowedGuessWordsPath = new URL('../resources/wordle-allowed-guesses.json', import.meta.url)
const gaokaoWordsPath = new URL('../resources/wordle-cn-gaokao-words.json', import.meta.url)
const cet4WordsPath = new URL('../resources/wordle-cn-cet4-words.json', import.meta.url)
const cet6WordsPath = new URL('../resources/wordle-cn-cet6-words.json', import.meta.url)
const fallbackAnswerWords = ['APPLE', 'HOUSE', 'TRAIN', 'WORLD', 'SMILE']
const answerWordList = loadWordList(answerWordsPath, fallbackAnswerWords)
const allowedGuessWordList = loadWordList(allowedGuessWordsPath)
const gaokaoWordList = loadWordList(gaokaoWordsPath)
const cet4ExtraWordList = loadWordList(cet4WordsPath)
const cet6ExtraWordList = loadWordList(cet6WordsPath)
const cet4WordList = [...gaokaoWordList, ...cet4ExtraWordList]
const cet6WordList = [...cet4WordList, ...cet6ExtraWordList]
const difficultyWordListMap = {
  0: gaokaoWordList,
  1: cet4WordList,
  2: cet6WordList
}
const wordSet = new Set([
  ...answerWordList,
  ...allowedGuessWordList,
  ...gaokaoWordList,
  ...cet4ExtraWordList,
  ...cet6ExtraWordList
])

function normalizeWordList(raw) {
  return filterBlockedWords([...new Set((Array.isArray(raw) ? raw : [])
    .map(word => String(word || '').trim().toUpperCase())
    .filter(word => /^[A-Z]{5}$/.test(word)))])
}

function loadWordList(fileUrl, fallback = []) {
  try {
    const raw = JSON.parse(fs.readFileSync(fileUrl, 'utf8'))
    const words = normalizeWordList(raw)
    return words.length ? words : normalizeWordList(fallback)
  } catch {
    return normalizeWordList(fallback)
  }
}

function getWordleKey(sessionId, userId) {
  return `${sessionId}:${userId}`
}

function roll(range) {
  const [min, max] = range
  return Math.floor(Math.random() * (max - min + 1)) + min
}

export function getWordleGame(sessionId, userId) {
  return wordleGames.get(getWordleKey(sessionId, userId))
}

export function setWordleGame(sessionId, userId, game) {
  wordleGames.set(getWordleKey(sessionId, userId), game)
}

export function deleteWordleGame(sessionId, userId) {
  wordleGames.delete(getWordleKey(sessionId, userId))
}

export function getWordleAnswerPool(difficultyId) {
  const difficultyPool = difficultyWordListMap[difficultyId]
  return difficultyPool?.length ? difficultyPool : answerWordList
}

export function getRandomWordleWord(difficultyId, random = Math.random) {
  const wordList = getWordleAnswerPool(difficultyId)
  return wordList[Math.floor(random() * wordList.length)]
}

export function isValidWordleWord(word) {
  const normalizedWord = String(word || '').trim().toUpperCase()
  return Boolean(normalizedWord) && !isBlockedSexualWord(normalizedWord) && wordSet.has(normalizedWord)
}

export function normalizeWordleGuess(word) {
  return String(word || '').trim().toUpperCase()
}

export function evaluateWordleGuess(answer, guess) {
  const answerLetters = answer.split('')
  const guessLetters = guess.split('')
  const marks = Array(guessLetters.length).fill('🔴')
  const usedAnswer = Array(answerLetters.length).fill(false)

  for (let i = 0; i < guessLetters.length; i++) {
    if (guessLetters[i] === answerLetters[i]) {
      marks[i] = '🟢'
      usedAnswer[i] = true
    }
  }

  for (let i = 0; i < guessLetters.length; i++) {
    if (marks[i] === '🟢') {
      continue
    }

    const hitIndex = answerLetters.findIndex((letter, index) =>
      !usedAnswer[index] && letter === guessLetters[i]
    )

    if (hitIndex !== -1) {
      marks[i] = '🟠'
      usedAnswer[hitIndex] = true
    }
  }

  return marks
}

export function formatWordleHistory(history) {
  return history.map((item, index) =>
    `  第${index + 1}次输入: ${item.guess.split('').map((letter, i) => `${letter}${item.marks[i]}`).join(' | ')}`
  )
}

export function getWordleRemainingSeconds(game, difficulty) {
  if (!difficulty.timeLimit) {
    return null
  }

  return Math.max(0, difficulty.timeLimit - Math.floor((Date.now() - game.startTime) / 1000))
}

export function isWordleTimeout(game, difficulty) {
  if (!difficulty.timeLimit) {
    return false
  }

  return getWordleRemainingSeconds(game, difficulty) <= 0
}

export function calculateWordleRewards(game, difficulty) {
  let coinReward = roll(difficulty.coinRange)
  let favorReward = roll(difficulty.favorRange)
  const tryRate = Math.max(0.25, 1 - ((game.history.length - 1) * 0.1))

  coinReward = Math.max(1, Math.floor(coinReward * tryRate))
  favorReward = Math.max(1, Math.floor(favorReward * tryRate))

  return { coinReward, favorReward }
}

export function calculateWordlePenalty(difficulty) {
  return difficulty?.penaltyRange ? roll(difficulty.penaltyRange) : 0
}
