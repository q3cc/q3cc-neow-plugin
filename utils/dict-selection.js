export const DICT_SELECTION_TTL_MS = 5 * 60 * 1000

const pendingDictSelections = new Map()

function getDictSelectionKey(sessionId, userId) {
  return `${String(sessionId)}:${String(userId)}`
}

function normalizeSelectionText(value) {
  return String(value || '').trim()
}

function normalizeSelectionEntries(entries = []) {
  return (Array.isArray(entries) ? entries : [])
    .map(item => ({
      entry: normalizeSelectionText(item?.entry),
      explain: normalizeSelectionText(item?.explain)
    }))
    .filter(item => item.entry)
    .slice(0, 5)
}

export function clearPendingDictSelection(sessionId, userId) {
  pendingDictSelections.delete(getDictSelectionKey(sessionId, userId))
}

export function setPendingDictSelection(sessionId, userId, selection, now = Date.now()) {
  const entries = normalizeSelectionEntries(selection?.entries)

  if (!entries.length) {
    clearPendingDictSelection(sessionId, userId)
    return null
  }

  const normalizedSelection = {
    query: normalizeSelectionText(selection?.query),
    entries,
    createdAt: now
  }

  pendingDictSelections.set(getDictSelectionKey(sessionId, userId), normalizedSelection)
  return normalizedSelection
}

export function getPendingDictSelection(sessionId, userId, now = Date.now()) {
  const selection = pendingDictSelections.get(getDictSelectionKey(sessionId, userId))
  if (!selection) {
    return null
  }

  if (now - selection.createdAt > DICT_SELECTION_TTL_MS) {
    clearPendingDictSelection(sessionId, userId)
    return null
  }

  return selection
}

export function pickPendingDictSelection(sessionId, userId, index, now = Date.now()) {
  const selection = getPendingDictSelection(sessionId, userId, now)
  if (!selection) {
    return {
      ok: false,
      reason: 'missing'
    }
  }

  const numericIndex = Number(index)
  if (!Number.isInteger(numericIndex) || numericIndex < 1 || numericIndex > selection.entries.length) {
    return {
      ok: false,
      reason: 'out_of_range',
      selection
    }
  }

  return {
    ok: true,
    reason: 'ok',
    index: numericIndex,
    selection,
    entry: selection.entries[numericIndex - 1]
  }
}
