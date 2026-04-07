import { getBrowser, sleep } from './render-browser.js'

const DEFAULT_TITLE = 'Star 币排行榜'
const DEFAULT_SUBTITLE = '看看谁是大富翁'
const DEFAULT_FOOTER = 'q3cc-neow-plugin'
const RANK_ENTRY_LIMIT = 10

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function normalizePositiveInteger(value, fallback = 0) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    return fallback
  }

  const normalized = Math.trunc(parsed)
  return normalized > 0 ? normalized : fallback
}

function normalizeEntry(entry = {}) {
  const name = String(entry.name ?? '').trim()

  return {
    rank: normalizePositiveInteger(entry.rank),
    name: escapeHtml(name || '未知昵称'),
    coins: escapeHtml(entry.coins)
  }
}

function getRankRowClass(rank) {
  if (rank === 1) {
    return 'champion'
  }

  if (rank === 2) {
    return 'runner-up'
  }

  if (rank === 3) {
    return 'third'
  }

  return 'standard'
}

function renderRankRows(entries = []) {
  const normalizedEntries = entries
    .slice(0, RANK_ENTRY_LIMIT)
    .map(item => normalizeEntry(item))

  const rows = []

  for (let index = 0; index < RANK_ENTRY_LIMIT; index++) {
    const entry = normalizedEntries[index]

    if (entry?.rank) {
      rows.push(`
        <div class="rank-row ${getRankRowClass(entry.rank)}">
          <div class="rank-badge" aria-label="第 ${entry.rank} 名">
            <span>${entry.rank}</span>
          </div>
          <div class="rank-content">
            <div class="rank-label">${entry.name}</div>
          </div>
          <div class="coin-pill">${entry.coins} 枚 Star 币</div>
        </div>
      `)
      continue
    }

    rows.push(`
      <div class="rank-row placeholder" aria-hidden="true">
        <div class="rank-badge"><span>&nbsp;</span></div>
        <div class="rank-content">
          <div class="rank-label">&nbsp;</div>
        </div>
        <div class="coin-pill">&nbsp;</div>
      </div>
    `)
  }

  return rows.join('')
}

function renderCurrentUserCard(entry) {
  if (!entry) {
    return ''
  }

  const currentUser = normalizeEntry(entry)
  if (!currentUser.rank) {
    return ''
  }

  return `
    <div class="self-card">
      <div class="self-title">你当前第 ${currentUser.rank} 名</div>
      <div class="self-row">
        <div class="self-name">${currentUser.name}</div>
        <div class="self-coins">${currentUser.coins} 枚 Star 币</div>
      </div>
    </div>
  `
}

export function createRankPreviewCard() {
  return {
    title: DEFAULT_TITLE,
    subtitle: DEFAULT_SUBTITLE,
    entries: [
      { rank: 1, name: '大喵喵', coins: 9999 },
      { rank: 2, name: '小星星', coins: 8848 },
      { rank: 3, name: '团子', coins: 6666 },
      { rank: 4, name: '阿月', coins: 5200 },
      { rank: 5, name: '云朵', coins: 4096 },
      { rank: 6, name: '糖糖', coins: 3666 },
      { rank: 7, name: '夏夜', coins: 2999 },
      { rank: 8, name: '铃兰', coins: 2400 },
      { rank: 9, name: '白雪', coins: 1888 },
      { rank: 10, name: '花火', coins: 1666 }
    ],
    currentUser: {
      rank: 18,
      name: '主人',
      coins: 777
    },
    footerText: DEFAULT_FOOTER
  }
}

export function buildRankHtml(card = {}) {
  const title = escapeHtml(card.title || DEFAULT_TITLE)
  const subtitle = escapeHtml(card.subtitle || DEFAULT_SUBTITLE)
  const footerText = escapeHtml(card.footerText || DEFAULT_FOOTER)
  const rowsHtml = renderRankRows(Array.isArray(card.entries) ? card.entries : [])
  const currentUserHtml = renderCurrentUserCard(card.currentUser)

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
        width: 720px;
        margin: 0 auto;
        padding: 8px 0 30px;
      }
      .header {
        margin-bottom: 26px;
        text-align: center;
      }
      .title {
        margin: 0;
        font-size: 38px;
        line-height: 1.15;
        font-weight: 800;
        letter-spacing: 0.02em;
      }
      .subtitle {
        margin-top: 10px;
        font-size: 18px;
        line-height: 1.6;
        color: #787c7e;
        font-weight: 600;
      }
      .board {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .rank-row {
        min-height: 72px;
        border: 2px solid #d3d6da;
        border-radius: 14px;
        background: #ffffff;
        display: flex;
        align-items: center;
        gap: 16px;
        padding: 12px 16px;
      }
      .rank-badge {
        width: 64px;
        height: 64px;
        flex: 0 0 64px;
        border: 2px solid #d3d6da;
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #ffffff;
        color: #1a1a1b;
      }
      .rank-badge span {
        display: block;
        font-size: 28px;
        line-height: 1;
        font-weight: 800;
      }
      .rank-content {
        flex: 1;
        min-width: 0;
      }
      .rank-label,
      .self-name {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .rank-label {
        font-size: 26px;
        line-height: 1.3;
        font-weight: 700;
        letter-spacing: 0.01em;
      }
      .coin-pill {
        min-width: 190px;
        padding: 0 16px;
        height: 50px;
        border-radius: 999px;
        background: #f3f4f6;
        color: #1a1a1b;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 20px;
        line-height: 1;
        font-weight: 700;
        white-space: nowrap;
      }
      .rank-row.champion {
        border-color: #6aaa64;
      }
      .rank-row.champion .rank-badge {
        background: #6aaa64;
        border-color: #6aaa64;
        color: #ffffff;
      }
      .rank-row.champion .coin-pill {
        background: #6aaa64;
        color: #ffffff;
      }
      .rank-row.runner-up {
        border-color: #c9b458;
      }
      .rank-row.runner-up .rank-badge {
        background: #c9b458;
        border-color: #c9b458;
        color: #ffffff;
      }
      .rank-row.runner-up .coin-pill {
        background: #c9b458;
        color: #ffffff;
      }
      .rank-row.third {
        border-color: #787c7e;
      }
      .rank-row.third .rank-badge {
        background: #787c7e;
        border-color: #787c7e;
        color: #ffffff;
      }
      .rank-row.third .coin-pill {
        background: #787c7e;
        color: #ffffff;
      }
      .rank-row.placeholder {
        border-style: dashed;
        background: #ffffff;
      }
      .rank-row.placeholder .rank-badge,
      .rank-row.placeholder .coin-pill {
        background: #ffffff;
        color: #d3d6da;
      }
      .rank-row.placeholder .rank-label {
        color: #d3d6da;
      }
      .self-card {
        margin-top: 18px;
        padding: 18px 20px;
        border: 2px solid #d3d6da;
        border-radius: 14px;
        background: #ffffff;
      }
      .self-title {
        font-size: 20px;
        line-height: 1.4;
        font-weight: 800;
        margin-bottom: 12px;
      }
      .self-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
      }
      .self-name {
        flex: 1;
        min-width: 0;
        font-size: 22px;
        line-height: 1.4;
        font-weight: 700;
      }
      .self-coins {
        font-size: 22px;
        line-height: 1.4;
        font-weight: 700;
        white-space: nowrap;
      }
      .footer {
        margin-top: 28px;
        font-size: 13px;
        line-height: 1.6;
        color: #7f858c;
        text-align: center;
        font-weight: 700;
      }
    </style>
  </head>
  <body>
    <div class="canvas">
      <div class="header">
        <h1 class="title">${title}</h1>
        <div class="subtitle">${subtitle}</div>
      </div>
      <div class="board">${rowsHtml}</div>
      ${currentUserHtml}
      <div class="footer"><strong>${footerText}</strong></div>
    </div>
  </body>
  </html>`
}

export async function renderRankImage(card) {
  let page

  try {
    if (!Array.isArray(card?.entries) || !card.entries.length) {
      return null
    }

    const browser = await getBrowser()
    page = await browser.newPage()
    await page.setViewport({
      width: 900,
      height: 2200,
      deviceScaleFactor: 2
    })

    await page.setContent(buildRankHtml(card), {
      waitUntil: 'domcontentloaded'
    })
    await page.waitForSelector('.canvas')
    await sleep(120)

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
