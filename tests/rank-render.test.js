import test from 'node:test'
import assert from 'node:assert/strict'

import { buildRankHtml, createRankPreviewCard } from '../utils/rank-render.js'

test('排行榜预览卡会覆盖前十榜单和当前用户补充信息', () => {
  const card = createRankPreviewCard()

  assert.equal(card.entries.length, 10)
  assert.deepEqual(card.currentUser, {
    rank: 18,
    uid: 233,
    coins: 777
  })
})

test('排行榜 HTML 会渲染标题、十行榜单、前三强调和当前用户信息', () => {
  const html = buildRankHtml(createRankPreviewCard())

  assert.ok(html.includes('Star 币排行榜'))
  assert.ok(html.includes('看看谁是大富翁'))
  assert.equal((html.match(/class="rank-row/g) || []).length, 10)
  assert.ok(html.includes('class="rank-row champion"'))
  assert.ok(html.includes('class="rank-row runner-up"'))
  assert.ok(html.includes('class="rank-row third"'))
  assert.ok(html.includes('你当前第 18 名'))
  assert.ok(html.includes('q3cc-neow-plugin'))
})

test('排行榜 HTML 会转义用户输入内容', () => {
  const html = buildRankHtml({
    title: '<榜单>',
    subtitle: '"副标题" & more',
    entries: [
      { rank: 1, uid: '<script>', coins: '"999"' }
    ],
    currentUser: {
      rank: 12,
      uid: '\'><img>',
      coins: '&777'
    },
    footerText: '<footer>'
  })

  assert.ok(html.includes('&lt;榜单&gt;'))
  assert.ok(html.includes('&quot;副标题&quot; &amp; more'))
  assert.ok(html.includes('UID &lt;script&gt;'))
  assert.ok(html.includes('&quot;999&quot; 枚 Star 币'))
  assert.ok(html.includes('UID &#39;&gt;&lt;img&gt;'))
  assert.ok(html.includes('&amp;777 枚 Star 币'))
  assert.ok(html.includes('&lt;footer&gt;'))
})
