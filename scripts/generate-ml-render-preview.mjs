import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { buildMlHtml, createMlPreviewCard } from '../utils/ml-render.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const outputPath = path.join(rootDir, 'resources', 'ml-render-preview.html')

const html = buildMlHtml(createMlPreviewCard())
fs.writeFileSync(outputPath, html, 'utf8')

console.log(`已生成预览文件: ${outputPath}`)
