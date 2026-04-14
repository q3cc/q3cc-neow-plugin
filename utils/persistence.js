import fs from 'fs'
import fsp from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export const pluginDataDirPath = path.join(__dirname, '../data/q3cc-neow-plugin')
export const sharedStateTransactionPath = path.join(pluginDataDirPath, 'farm-user-state.transaction.json')

function buildTempFilePath(filePath) {
  const suffix = `${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`
  return path.join(path.dirname(filePath), `.${path.basename(filePath)}.${suffix}.tmp`)
}

function normalizeTransactionWrites(writes) {
  if (!Array.isArray(writes) || !writes.length) {
    throw new Error('共享事务写入列表不能为空')
  }

  return writes.map(write => {
    const filePath = String(write?.filePath || '').trim()
    if (!filePath) {
      throw new Error('共享事务目标路径不能为空')
    }

    return {
      filePath,
      content: String(write?.content ?? '')
    }
  })
}

export async function writeTextFileAtomically(filePath, content) {
  const tempPath = buildTempFilePath(filePath)
  await fsp.mkdir(path.dirname(filePath), { recursive: true })

  try {
    await fsp.writeFile(tempPath, content, 'utf8')
    await fsp.rename(tempPath, filePath)
  } finally {
    if (fs.existsSync(tempPath)) {
      await fsp.rm(tempPath, { force: true })
    }
  }
}

function writeTextFileAtomicallySync(filePath, content) {
  const tempPath = buildTempFilePath(filePath)
  fs.mkdirSync(path.dirname(filePath), { recursive: true })

  try {
    fs.writeFileSync(tempPath, content, 'utf8')
    fs.renameSync(tempPath, filePath)
  } finally {
    if (fs.existsSync(tempPath)) {
      fs.rmSync(tempPath, { force: true })
    }
  }
}

export async function commitSharedStateTransaction(writes, transactionPath = sharedStateTransactionPath) {
  const normalizedWrites = normalizeTransactionWrites(writes)
  const payload = JSON.stringify({
    version: 1,
    createdAt: new Date().toISOString(),
    writes: normalizedWrites
  }, null, 2)

  await writeTextFileAtomically(transactionPath, payload)

  for (const write of normalizedWrites) {
    await writeTextFileAtomically(write.filePath, write.content)
  }

  await fsp.rm(transactionPath, { force: true })
}

export function recoverSharedStateTransaction(transactionPath = sharedStateTransactionPath) {
  if (!fs.existsSync(transactionPath)) {
    return { recovered: false, error: '' }
  }

  let transaction
  try {
    transaction = JSON.parse(fs.readFileSync(transactionPath, 'utf8'))
  } catch (error) {
    return {
      recovered: false,
      error: `读取共享事务失败: ${error?.message || error}`
    }
  }

  try {
    const writes = normalizeTransactionWrites(transaction?.writes)
    for (const write of writes) {
      writeTextFileAtomicallySync(write.filePath, write.content)
    }
    fs.rmSync(transactionPath, { force: true })
    return { recovered: true, error: '' }
  } catch (error) {
    return {
      recovered: false,
      error: `恢复共享事务失败: ${error?.message || error}`
    }
  }
}
