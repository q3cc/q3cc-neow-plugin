import fs from 'fs'

export const WORDLE_DIFFICULTIES = {
  0: {
    name: '简单',
    desc: '8 次机会, 无时间限制',
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
    stamina: 25,
    maxAttempts: 4,
    timeLimit: 60,
    coinRange: [5, 10],
    favorRange: [3, 7],
    penaltyRange: [4, 6]
  }
}

const wordleGames = new Map()
const wordsPath = new URL('../resources/wordle-words.json', import.meta.url)
const wordList = loadWordList()
const wordSet = new Set(wordList)

function loadWordList() {
  try {
    const raw = JSON.parse(fs.readFileSync(wordsPath, 'utf8'))
    return raw
      .map(word => String(word || '').trim().toUpperCase())
      .filter(word => /^[A-Z]{5}$/.test(word))
  } catch {
    return ['APPLE', 'HOUSE', 'TRAIN', 'WORLD', 'SMILE']
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

export function getRandomWordleWord() {
  return wordList[Math.floor(Math.random() * wordList.length)]
}

export function isValidWordleWord(word) {
  return wordSet.has(String(word || '').trim().toUpperCase())
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
