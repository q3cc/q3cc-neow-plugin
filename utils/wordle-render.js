import { getBrowser, sleep } from './render-browser.js'

const KEYBOARD_ROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM']
const MARK_PRIORITY = {
  '': 0,
  '🔴': 1,
  '🟠': 2,
  '🟢': 3
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function getTileClass(mark) {
  if (mark === '🟢') {
    return 'green'
  }
  if (mark === '🟠') {
    return 'yellow'
  }
  if (mark === '🔴') {
    return 'gray'
  }
  return 'empty'
}

function buildKeyboardStatus(history = []) {
  const statusMap = {}

  for (const item of history) {
    item.guess.split('').forEach((letter, index) => {
      const mark = item.marks[index]
      const currentMark = statusMap[letter] || ''

      if (MARK_PRIORITY[mark] > MARK_PRIORITY[currentMark]) {
        statusMap[letter] = mark
      }
    })
  }

  return statusMap
}

function renderBoard(history = [], maxAttempts = 6) {
  const rows = []

  for (let i = 0; i < maxAttempts; i++) {
    const item = history[i]

    if (item) {
      rows.push(`
        <div class="board-row">
          ${item.guess.split('').map((letter, index) => `
            <div class="tile ${getTileClass(item.marks[index])}">
              <span>${escapeHtml(letter)}</span>
            </div>
          `).join('')}
        </div>
      `)
      continue
    }

    rows.push(`
      <div class="board-row">
        ${Array.from({ length: 5 }, () => `
          <div class="tile empty">
            <span>&nbsp;</span>
          </div>
        `).join('')}
      </div>
    `)
  }

  return rows.join('')
}

function renderKeyboard(history = []) {
  const statusMap = buildKeyboardStatus(history)

  return KEYBOARD_ROWS.map((row, index) => `
    <div class="keyboard-row ${index === 1 ? 'row-offset-1' : index === 2 ? 'row-offset-2' : ''}">
      ${row.split('').map(letter => `
        <div class="key ${getTileClass(statusMap[letter])}">
          <span>${letter}</span>
        </div>
      `).join('')}
    </div>
  `).join('')
}

function buildWordleHtml(card) {
  const maxAttempts = Number.isInteger(card?.maxAttempts) && card.maxAttempts > 0
    ? card.maxAttempts
    : Math.max(6, Array.isArray(card?.history) ? card.history.length : 0)

  return `<!DOCTYPE html>
  <html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <style>
      * { box-sizing: border-box; }
      body {
        margin: 0;
        padding: 30px 24px 38px;
        font-family: Inter, "Microsoft YaHei", "PingFang SC", Arial, sans-serif;
        background: #ffffff;
        color: #1a1a1b;
      }
      .canvas {
        width: 560px;
        margin: 0 auto;
        padding: 4px 0 12px;
      }
      .board {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 10px;
      }
      .board-row {
        display: flex;
        gap: 10px;
      }
      .tile {
        width: 78px;
        height: 78px;
        border: 2px solid #d3d6da;
        border-radius: 2px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #ffffff;
        color: #1a1a1b;
      }
      .tile span {
        display: block;
        font-size: 34px;
        line-height: 1;
        font-weight: 700;
        letter-spacing: 0.02em;
        text-transform: uppercase;
      }
      .tile.green {
        background: #6aaa64;
        border-color: #6aaa64;
        color: #ffffff;
      }
      .tile.yellow {
        background: #c9b458;
        border-color: #c9b458;
        color: #ffffff;
      }
      .tile.gray {
        background: #787c7e;
        border-color: #787c7e;
        color: #ffffff;
      }
      .keyboard {
        margin-top: 38px;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
      }
      .keyboard-row {
        display: flex;
        gap: 6px;
      }
      .row-offset-1 { padding-left: 18px; }
      .row-offset-2 { padding-left: 34px; }
      .key {
        min-width: 48px;
        height: 58px;
        padding: 0 10px;
        border-radius: 6px;
        background: #d3d6da;
        color: #1a1a1b;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .key span {
        display: block;
        font-size: 22px;
        line-height: 1;
        font-weight: 600;
        text-transform: uppercase;
      }
      .key.green { background: #6aaa64; }
      .key.yellow { background: #c9b458; }
      .key.gray { background: #787c7e; }
      .key.green,
      .key.yellow,
      .key.gray {
        color: #ffffff;
      }
      .key.empty {
        background: #d3d6da;
        color: #1a1a1b;
      }
    </style>
  </head>
  <body>
    <div class="canvas">
      <div class="board">${renderBoard(card.history, maxAttempts)}</div>
      <div class="keyboard">${renderKeyboard(card.history)}</div>
    </div>
  </body>
  </html>`
}

export async function renderWordleImage(card) {
  let page

  try {
    if (!Array.isArray(card?.history)) {
      return null
    }

    const browser = await getBrowser()
    page = await browser.newPage()
    await page.setViewport({
      width: 720,
      height: 1600,
      deviceScaleFactor: 2
    })

    await page.setContent(buildWordleHtml(card), {
      waitUntil: 'domcontentloaded'
    })
    await page.waitForSelector('.canvas')
    await sleep(100)

    const element = await page.$('.canvas')
    if (!element) {
      return null
    }

    return await element.screenshot({
      type: 'png',
      omitBackground: false
    })
  } catch {
    return null
  } finally {
    if (page) {
      try {
        await page.close()
      } catch {}
    }
  }
}
