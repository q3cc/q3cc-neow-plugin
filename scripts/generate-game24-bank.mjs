import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const BANK_SPECS = {
  1: {
    ratio: '0:10',
    parts: [
      { count: 3, total: 400, solvable: false },
      { count: 4, total: 600, solvable: false }
    ]
  },
  2: {
    ratio: '3:7',
    parts: [
      { count: 3, total: 250, solvable: false },
      { count: 4, total: 450, solvable: false },
      { count: 4, total: 150, solvable: true },
      { count: 5, total: 100, solvable: true },
      { count: 6, total: 50, solvable: true }
    ]
  },
  3: {
    ratio: '5:5',
    parts: [
      { count: 3, total: 150, solvable: false },
      { count: 4, total: 350, solvable: false },
      { count: 4, total: 150, solvable: true },
      { count: 5, total: 200, solvable: true },
      { count: 6, total: 150, solvable: true }
    ]
  },
  4: {
    ratio: '7:3',
    parts: [
      { count: 3, total: 100, solvable: false },
      { count: 4, total: 200, solvable: false },
      { count: 4, total: 200, solvable: true },
      { count: 5, total: 250, solvable: true },
      { count: 6, total: 250, solvable: true }
    ]
  },
  5: {
    ratio: '10:0',
    parts: [
      { count: 4, total: 200, solvable: true },
      { count: 5, total: 350, solvable: true },
      { count: 6, total: 450, solvable: true }
    ]
  }
}

const bankId = Number(process.argv[2])
const spec = BANK_SPECS[bankId]

if (!spec) {
  console.error('用法: node scripts/generate-game24-bank.mjs <1-5>')
  process.exit(1)
}

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const outputPath = path.join(__dirname, `../resources/game24-bank-${bankId}.json`)

function randNums(count) {
  return Array.from({ length: count }, () => Math.floor(Math.random() * 13) + 1)
}

function solve24(numbers) {
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
          if (Math.abs(newNum) > 1000) {
            continue
          }

          const result = solve(
            [...remaining, newNum],
            [...remainingExprs, newExpr]
          )

          if (result) {
            return result
          }
        }
      }
    }

    return null
  }

  return solve(
    numbers.map(value => parseFloat(value)),
    numbers.map(value => String(value))
  )
}

function generatePart(bankSeen, bankId, startIndex, part) {
  const items = []
  let nextIndex = startIndex

  while (items.length < part.total) {
    const numbers = randNums(part.count)
    const key = `${part.count}:${numbers.join(',')}`
    if (bankSeen.has(key)) {
      continue
    }

    const solution = solve24(numbers)
    const isSolvable = Boolean(solution)
    if (isSolvable !== part.solvable) {
      continue
    }

    bankSeen.add(key)
    items.push({
      id: `${bankId}-${String(nextIndex++).padStart(4, '0')}`,
      numbers,
      solution
    })
  }

  return {
    items,
    nextIndex
  }
}

const seen = new Set()
let nextIndex = 1
const items = []

for (const part of spec.parts) {
  const result = generatePart(seen, bankId, nextIndex, part)
  items.push(...result.items)
  nextIndex = result.nextIndex
}

for (let i = items.length - 1; i > 0; i--) {
  const j = Math.floor(Math.random() * (i + 1))
  ;[items[i], items[j]] = [items[j], items[i]]
}

const solvable = items.filter(item => item.solution).length
const unsolvable = items.length - solvable

fs.writeFileSync(outputPath, JSON.stringify({
  version: 1,
  bankId,
  ratio: spec.ratio,
  total: items.length,
  solvable,
  unsolvable,
  parts: spec.parts,
  items
}, null, 2), 'utf8')

console.log(JSON.stringify({
  file: outputPath,
  bankId,
  ratio: spec.ratio,
  total: items.length,
  solvable,
  unsolvable
}))
