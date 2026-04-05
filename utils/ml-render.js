import { getBrowser, sleep } from './render-browser.js'

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function renderHistory(history = []) {
  if (!history.length) {
    return ''
  }

  return `
    <div class="section">
      <div class="board-list">
        ${history.map(item => `
          <div class="board-row">
            <div class="history-cells" style="grid-template-columns: repeat(${item.guess.length}, 72px)">
              ${item.guess.split('').map((digit, digitIndex) => {
                const mark = item.marks[digitIndex]
                const cls = mark === '🟢' ? 'green' : mark === '🟠' ? 'yellow' : 'gray'
                return `
                  <div class="cell ${cls}">
                    <div class="digit">${escapeHtml(digit)}</div>
                  </div>
                `
              }).join('')}
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `
}

export function createMlPreviewCard() {
  return {
    history: [
      { guess: '7381', marks: ['🟢', '🟠', '🔴', '🟢'] },
      { guess: '5924', marks: ['🟠', '🔴', '🟢', '🟠'] }
    ]
  }
}

export function buildMlHtml(card) {
  return `<!DOCTYPE html>
  <html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <style>
      * { box-sizing: border-box; }
      body {
        margin: 0;
        padding: 28px;
        font-family: "Microsoft YaHei", "PingFang SC", Arial, sans-serif;
        background: #f4f3f1;
        color: #1f2328;
      }
      .card {
        width: 860px;
        min-height: 420px;
        margin: 0 auto;
        border-radius: 16px;
        overflow: hidden;
        background: #ffffff;
        border: 1px solid #e4e1dc;
        box-shadow: 0 18px 50px rgba(32, 35, 40, 0.08);
      }
      .content {
        min-height: 420px;
        padding: 30px 24px 24px;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
      }
      .section {
        min-height: 300px;
        padding: 10px 0;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .board-list {
        display: flex;
        flex-direction: column;
        gap: 18px;
        align-items: center;
      }
      .board-row {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0;
      }
      .history-cells {
        display: grid;
        gap: 8px;
      }
      .cell {
        width: 72px;
        height: 72px;
        border-radius: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #fff;
        border: 2px solid #d3d6da;
        background: #787c7e;
        box-shadow: none;
      }
      .cell.green {
        background: #6aaa64;
        border-color: #6aaa64;
      }
      .cell.yellow {
        background: #c9b458;
        border-color: #c9b458;
      }
      .cell.gray {
        background: #787c7e;
        border-color: #787c7e;
      }
      .cell.mini {
        width: 44px;
        height: 44px;
      }
      .digit {
        font-size: 31px;
        font-weight: 800;
        line-height: 1;
        letter-spacing: 0.02em;
      }
      .mini .digit { font-size: 20px; }
      .footer {
        margin-top: 24px;
        font-size: 13px;
        line-height: 1.6;
        color: #7f858c;
        text-align: center;
        font-weight: 700;
      }
    </style>
  </head>
  <body>
    <div class="card">
      <div class="content">
        ${renderHistory(card.history)}
        <div class="footer"><strong>${escapeHtml(card.footerText || 'q3cc-neow-plugin')}</strong></div>
      </div>
    </div>
  </body>
  </html>`
}

export async function renderMlImage(card) {
  let page

  try {
    if (!Array.isArray(card?.history) || !card.history.length) {
      return null
    }

    const browser = await getBrowser()
    page = await browser.newPage()
    await page.setViewport({
      width: 1080,
      height: 1600,
      deviceScaleFactor: 2
    })

    await page.setContent(buildMlHtml(card), {
      waitUntil: 'domcontentloaded'
    })
    await page.waitForSelector('.card')
    await sleep(120)

    const element = await page.$('.card')
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
