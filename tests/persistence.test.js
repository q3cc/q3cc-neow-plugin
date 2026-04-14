import fs from 'fs'
import fsp from 'fs/promises'
import os from 'os'
import path from 'path'
import test from 'node:test'
import assert from 'node:assert/strict'

import {
  commitSharedStateTransaction,
  recoverSharedStateTransaction,
  writeTextFileAtomically
} from '../utils/persistence.js'

async function createTempDir() {
  return fsp.mkdtemp(path.join(os.tmpdir(), 'persist-test-'))
}

test('共享事务会在恢复时补齐崩溃前只写了一半的文件', async () => {
  const rootDir = await createTempDir()
  const usersPath = path.join(rootDir, 'users.json')
  const farmPath = path.join(rootDir, 'farm-state.json')
  const transactionPath = path.join(rootDir, 'farm-user.transaction.json')
  const usersContent = JSON.stringify({ alice: { coins: 12 } }, null, 2)
  const farmContent = JSON.stringify({ alice: { seeds: { radish: { count: 7 } } } }, null, 2)

  try {
    await writeTextFileAtomically(transactionPath, JSON.stringify({
      version: 1,
      writes: [
        { filePath: usersPath, content: usersContent },
        { filePath: farmPath, content: farmContent }
      ]
    }, null, 2))
    await writeTextFileAtomically(usersPath, usersContent)

    const recovery = recoverSharedStateTransaction(transactionPath)
    assert.equal(recovery.error, '')
    assert.equal(recovery.recovered, true)
    assert.equal(fs.existsSync(transactionPath), false)
    assert.equal(await fsp.readFile(usersPath, 'utf8'), usersContent)
    assert.equal(await fsp.readFile(farmPath, 'utf8'), farmContent)
  } finally {
    await fsp.rm(rootDir, { recursive: true, force: true })
  }
})

test('共享事务提交成功后不会留下事务文件', async () => {
  const rootDir = await createTempDir()
  const usersPath = path.join(rootDir, 'users.json')
  const farmPath = path.join(rootDir, 'farm-state.json')
  const transactionPath = path.join(rootDir, 'farm-user.transaction.json')

  try {
    await commitSharedStateTransaction([
      { filePath: usersPath, content: JSON.stringify({ coins: 8 }, null, 2) },
      { filePath: farmPath, content: JSON.stringify({ crops: { tomato: 2 } }, null, 2) }
    ], transactionPath)

    assert.equal(fs.existsSync(transactionPath), false)
    assert.deepEqual(JSON.parse(await fsp.readFile(usersPath, 'utf8')), { coins: 8 })
    assert.deepEqual(JSON.parse(await fsp.readFile(farmPath, 'utf8')), { crops: { tomato: 2 } })
  } finally {
    await fsp.rm(rootDir, { recursive: true, force: true })
  }
})
