export const ML_DIFFICULTIES = {
  0: {
    name: '简单',
    desc: '时间不限, 但第 5 次答错会直接爆炸',
    stamina: 10,
    timeLimit: 0,
    maxAttempts: 0,
    explodeAfter: 5,
    explodeChance: 1,
    coinRange: [1, 3],
    favorRange: [1, 2],
    penaltyRange: [1, 2]
  },
  1: {
    name: '普通',
    desc: '第 5 次答错会直接爆炸, 只有 2 分钟时间',
    stamina: 15,
    timeLimit: 120,
    maxAttempts: 0,
    explodeAfter: 5,
    explodeChance: 1,
    coinRange: [2, 5],
    favorRange: [1, 3],
    penaltyRange: [2, 4]
  },
  2: {
    name: '困难',
    desc: '你只有 5 次机会和 90 秒时间, 第 5 次答错会直接爆炸',
    stamina: 20,
    timeLimit: 90,
    maxAttempts: 5,
    explodeAfter: 5,
    explodeChance: 1,
    coinRange: [3, 7],
    favorRange: [2, 5],
    penaltyRange: [3, 5]
  },
  3: {
    name: '极限',
    desc: '你只有 4 次机会和 45 秒时间',
    stamina: 25,
    timeLimit: 45,
    maxAttempts: 4,
    explodeAfter: 0,
    explodeChance: 0,
    coinRange: [5, 10],
    favorRange: [3, 7],
    penaltyRange: [4, 6]
  },
  4: {
    name: '另类极限',
    desc: '你有无限次机会, 但第 5 次答错会直接爆炸, 并且只有 15 秒时间',
    stamina: 30,
    timeLimit: 15,
    maxAttempts: 0,
    explodeAfter: 5,
    explodeChance: 1,
    coinRange: [6, 12],
    favorRange: [3, 8],
    penaltyRange: [5, 8]
  }
}

export const ML_REPLY_MODES = {
  auto: {
    name: '自动',
    desc: '优先发送图片, 失败时自动降级为文字'
  },
  image: {
    name: '图片',
    desc: '优先尝试图片发送, 失败时仍会降级为文字'
  },
  text: {
    name: '文字',
    desc: '直接发送文字, 不走图片渲染'
  }
}

export const ML_FORCE_TEXT_DIFFICULTY = 4

const mlGames = new Map()

function getMlKey(groupId, userId) {
  return `${groupId}:${userId}`
}

function rollReward(range) {
  const [min, max] = range
  return Math.floor(Math.random() * (max - min + 1)) + min
}

export function getMlGame(groupId, userId) {
  return mlGames.get(getMlKey(groupId, userId))
}

export function setMlGame(groupId, userId, game) {
  mlGames.set(getMlKey(groupId, userId), game)
}

export function deleteMlGame(groupId, userId) {
  mlGames.delete(getMlKey(groupId, userId))
}

export function createPassword() {
  const digits = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']

  for (let i = digits.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[digits[i], digits[j]] = [digits[j], digits[i]]
  }

  return digits.slice(0, 4).join('')
}

export function normalizeMlReplyMode(mode) {
  const normalizedMode = String(mode || '').trim().toLowerCase()
  return normalizedMode in ML_REPLY_MODES
    ? normalizedMode
    : 'auto'
}

export function resolveMlReplyMode(mode, difficultyId) {
  if (Number(difficultyId) === ML_FORCE_TEXT_DIFFICULTY) {
    return 'text'
  }

  return normalizeMlReplyMode(mode)
}

export function evaluatePasswordGuess(answer, guess) {
  const answerDigits = answer.split('')
  const guessDigits = guess.split('')
  const marks = Array(guessDigits.length).fill('🔴')
  const usedAnswer = Array(answerDigits.length).fill(false)

  for (let i = 0; i < guessDigits.length; i++) {
    if (guessDigits[i] === answerDigits[i]) {
      marks[i] = '🟢'
      usedAnswer[i] = true
    }
  }

  for (let i = 0; i < guessDigits.length; i++) {
    if (marks[i] === '🟢') {
      continue
    }

    const hitIndex = answerDigits.findIndex((digit, index) =>
      !usedAnswer[index] && digit === guessDigits[i]
    )

    if (hitIndex !== -1) {
      marks[i] = '🟠'
      usedAnswer[hitIndex] = true
    }
  }

  return marks
}

export function formatMlHistory(history) {
  return history.map((item, index) =>
    `  第${index + 1}次输入: ${item.guess.split('').map((digit, i) => `${digit}${item.marks[i]}`).join(' | ')}`
  )
}

export function getMlRemainingSeconds(game, difficulty) {
  if (!difficulty.timeLimit) {
    return null
  }

  return Math.max(0, difficulty.timeLimit - Math.floor((Date.now() - game.startTime) / 1000))
}

export function isMlTimeout(game, difficulty) {
  if (!difficulty.timeLimit) {
    return false
  }

  return getMlRemainingSeconds(game, difficulty) <= 0
}

export function shouldMlExplode(game, difficulty) {
  if (!difficulty.explodeAfter) {
    return false
  }

  return game.history.length >= difficulty.explodeAfter
}

export function calculateMlRewards(game, difficulty) {
  let coinReward = rollReward(difficulty.coinRange)
  let favorReward = rollReward(difficulty.favorRange)

  const tryRate = Math.max(0.2, 1 - ((game.history.length - 1) * 0.08))
  coinReward = Math.max(1, Math.floor(coinReward * tryRate))
  favorReward = Math.max(1, Math.floor(favorReward * tryRate))

  return { coinReward, favorReward }
}

export function calculateMlPenalty(difficulty) {
  if (!difficulty?.penaltyRange) {
    return 0
  }

  return rollReward(difficulty.penaltyRange)
}
