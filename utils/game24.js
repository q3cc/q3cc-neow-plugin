import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

export const GAME24_DIFFICULTIES = {
  0: { name: '练习', numCount: 4, stamina: 0, coinRange: [0, 0], favorRange: [0, 0], penalty: 0, needFormula: false, bankWeights: [40, 30, 18, 9, 3] },
  1: { name: '普通', numCount: 4, stamina: 10, coinRange: [1, 4], favorRange: [1, 4], penalty: 2, needFormula: false, bankWeights: [25, 30, 23, 15, 7] },
  2: { name: '困难', numCount: [3, 4, 5], stamina: 20, coinRange: [1, 7], favorRange: [1, 7], penalty: 3, needFormula: false, bankWeights: [12, 20, 28, 25, 15] },
  3: { name: '极限', numCount: [4, 5, 6], stamina: 30, coinRange: [1, 15], favorRange: [1, 15], penalty: 7, needFormula: true, bankWeights: [5, 10, 20, 28, 37] }
}

const games = new Map()
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const questionBankPaths = [1, 2, 3, 4, 5].map(index =>
  path.join(__dirname, `../resources/game24-bank-${index}.json`)
)
const fallbackQuestions = [
  { id: 'fallback-1', numbers: [1, 4, 7, 10], solution: null },
  { id: 'fallback-2', numbers: [3, 3, 8, 8], solution: '(8/(3-(8/3)))' },
  { id: 'fallback-3', numbers: [2, 5, 12, 9, 1], solution: '((12-9)*(1+(2+5)))' },
  { id: 'fallback-4', numbers: [12, 7, 13, 13, 3, 10], solution: '((3-(13*13))+(10*(12+7)))' }
]

function normalizeQuestion(item) {
  return {
    id: item.id,
    numbers: item.numbers.map(value => Number(value)),
    solution: typeof item.solution === 'string' && item.solution ? item.solution : null
  }
}

function createBuckets(items) {
  return items.reduce((acc, item) => {
    const count = item.numbers.length
    if (!acc[count]) {
      acc[count] = []
    }

    acc[count].push(item)
    return acc
  }, {})
}

function loadQuestionBanks() {
  const banks = []

  for (const bankPath of questionBankPaths) {
    try {
      const raw = JSON.parse(fs.readFileSync(bankPath, 'utf8'))
      const items = Array.isArray(raw?.items)
        ? raw.items
            .filter(item => Array.isArray(item?.numbers) && item.numbers.length >= 3 && item.numbers.length <= 6)
            .map(normalizeQuestion)
        : []

      if (!items.length) {
        continue
      }

      banks.push({
        bankId: raw.bankId || path.basename(bankPath, '.json'),
        ratio: raw.ratio || 'unknown',
        buckets: createBuckets(items)
      })
    } catch {
      continue
    }
  }

  if (!banks.length) {
    return [{
      bankId: 'fallback',
      ratio: 'fallback',
      buckets: createBuckets(fallbackQuestions.map(normalizeQuestion))
    }]
  }

  return banks
}

const questionBanks = loadQuestionBanks()

function getBankWeight(bank, config) {
  if (!Array.isArray(config.bankWeights)) {
    return 1
  }

  const index = Number(bank.bankId) - 1
  return Number.isInteger(index) && index >= 0
    ? Math.max(0, config.bankWeights[index] || 0)
    : 1
}

function pickWeightedBank(banks, config) {
  const weightedBanks = banks.map(bank => ({
    bank,
    weight: getBankWeight(bank, config)
  })).filter(item => item.weight > 0)

  if (!weightedBanks.length) {
    return banks[Math.floor(Math.random() * banks.length)]
  }

  const totalWeight = weightedBanks.reduce((sum, item) => sum + item.weight, 0)
  let roll = Math.random() * totalWeight

  for (const item of weightedBanks) {
    roll -= item.weight
    if (roll <= 0) {
      return item.bank
    }
  }

  return weightedBanks[weightedBanks.length - 1].bank
}

export function getGameKey(groupId, userId) {
  return `${groupId}:${userId}`
}

export function setActiveGame(groupId, userId, game) {
  games.set(getGameKey(groupId, userId), game)
}

export function getActiveGame(groupId, userId) {
  return games.get(getGameKey(groupId, userId))
}

export function deleteActiveGame(groupId, userId) {
  games.delete(getGameKey(groupId, userId))
}

export function getRandomQuestion(config) {
  const counts = Array.isArray(config.numCount) ? config.numCount : [config.numCount]
  const eligibleBanks = questionBanks.filter(bank =>
    counts.some(count => Array.isArray(bank.buckets[count]) && bank.buckets[count].length)
  )
  const bank = pickWeightedBank(eligibleBanks.length ? eligibleBanks : questionBanks, config)
  const pool = counts.flatMap(count => bank.buckets[count] || [])

  if (!pool.length) {
    const fallback = fallbackQuestions[Math.floor(Math.random() * fallbackQuestions.length)]
    return {
      bankId: bank?.bankId || 'fallback',
      questionId: fallback.id,
      numbers: [...fallback.numbers],
      solution: fallback.solution
    }
  }

  const question = pool[Math.floor(Math.random() * pool.length)]
  return {
    bankId: bank.bankId,
    questionId: question.id,
    numbers: [...question.numbers],
    solution: question.solution
  }
}

export function rollReward(range) {
  const [min, max] = range
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function getAntiCheatRate(game, config, elapsed) {
  const numberCount = game.numbers.length

  if (numberCount <= 4 && !config.needFormula) {
    return 1
  }

  const baseSecondsByCount = {
    3: 10,
    4: 14,
    5: 24,
    6: 34
  }

  let expectedSeconds = baseSecondsByCount[numberCount] || 18
  if (config.needFormula) {
    expectedSeconds += 8
  }

  if (!game.solution) {
    expectedSeconds = Math.max(8, expectedSeconds - 4)
  }

  const graceSeconds = Math.max(8, Math.floor(expectedSeconds * 0.6))
  if (elapsed >= graceSeconds) {
    return 1
  }

  const speedRatio = clamp(elapsed / graceSeconds, 0.15, 1)
  const numericBankId = Number(game.bankId)
  const bankModifier = Number.isInteger(numericBankId)
    ? 0.85 + numericBankId * 0.05
    : 1

  return clamp(Math.pow(speedRatio, 1.35) * bankModifier, 0.15, 1)
}

export function calculateRewards(game, config, elapsed) {
  let coinReward = rollReward(config.coinRange)
  let favorReward = rollReward(config.favorRange)
  const antiCheatRate = getAntiCheatRate(game, config, elapsed)

  if (antiCheatRate < 1) {
    if (coinReward > 0) {
      coinReward = Math.max(1, Math.floor(coinReward * antiCheatRate))
    }
    if (favorReward > 0) {
      favorReward = Math.max(1, Math.floor(favorReward * antiCheatRate))
    }
  }

  return {
    coinReward,
    favorReward,
    antiCheatRate
  }
}
