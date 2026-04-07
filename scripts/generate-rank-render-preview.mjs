import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { buildRankHtml, createRankPreviewCard } from '../utils/rank-render.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const outputPath = path.join(rootDir, 'resources', 'rank-render-preview.html')

const html = buildRankHtml(createRankPreviewCard())
fs.writeFileSync(outputPath, html, 'utf8')

console.log(`已生成预览文件: ${outputPath}`)
