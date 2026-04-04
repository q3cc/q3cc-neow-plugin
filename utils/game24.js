export const GAME24_DIFFICULTIES = {
  0: { name: '练习', numCount: 4, stamina: 0, coinRange: [0, 0], favorRange: [0, 0], penalty: 0, needFormula: false },
  1: { name: '普通', numCount: 4, stamina: 10, coinRange: [1, 4], favorRange: [1, 4], penalty: 2, needFormula: false },
  2: { name: '困难', numCount: [3, 4, 5], stamina: 20, coinRange: [1, 7], favorRange: [1, 7], penalty: 3, needFormula: false },
  3: { name: '极限', numCount: [4, 5, 6], stamina: 30, coinRange: [1, 15], favorRange: [1, 15], penalty: 7, needFormula: true }
}

const games = new Map()

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

export function generateNumbers(count) {
  if (Array.isArray(count)) {
    count = count[Math.floor(Math.random() * count.length)]
  }

  const numbers = []
  for (let i = 0; i < count; i++) {
    numbers.push(Math.floor(Math.random() * 13) + 1)
  }

  return numbers
}

export function solve24(numbers) {
  const solve = (nums, exprs) => {
    if (nums.length === 1) {
      return Math.abs(nums[0] - 24) < 1e-6 ? exprs[0] : null
    }

    for (let i = 0; i < nums.length; i++) {
      for (let j = i + 1; j < nums.length; j++) {
        const a = nums[i]
        const b = nums[j]
        const ea = exprs[i]
        const eb = exprs[j]
        const remaining = nums.filter((_, k) => k !== i && k !== j)
        const remainingExprs = exprs.filter((_, k) => k !== i && k !== j)

        const ops = [
          [a + b, `(${ea}+${eb})`],
          [a - b, `(${ea}-${eb})`],
          [b - a, `(${eb}-${ea})`],
          [a * b, `(${ea}*${eb})`]
        ]

        if (Math.abs(b) > 1e-9) ops.push([a / b, `(${ea}/${eb})`])
        if (Math.abs(a) > 1e-9) ops.push([b / a, `(${eb}/${ea})`])

        for (const [newNum, newExpr] of ops) {
          if (Math.abs(newNum) > 1000) continue

          const result = solve(
            [...remaining, newNum],
            [...remainingExprs, newExpr]
          )

          if (result) return result
        }
      }
    }

    return null
  }

  const nums = numbers.map(n => parseFloat(n))
  const exprs = nums.map(n => n.toString())
  return solve(nums, exprs)
}

export function rollReward(range) {
  const [min, max] = range
  return Math.floor(Math.random() * (max - min + 1)) + min
}

export function calculateRewards(game, config, elapsed) {
  let coinReward = rollReward(config.coinRange)
  let favorReward = rollReward(config.favorRange)

  if (game.numbers.length > 4 && elapsed < 30) {
    const timeRate = Math.max(0.2, elapsed / 30)
    if (coinReward > 0) {
      coinReward = Math.max(1, Math.floor(coinReward * timeRate))
    }
    if (favorReward > 0) {
      favorReward = Math.max(1, Math.floor(favorReward * timeRate))
    }
  }

  return {
    coinReward,
    favorReward
  }
}
