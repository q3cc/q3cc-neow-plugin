const YOUDAO_ENDPOINT = 'https://dict.youdao.com/jsonapi'
const DEFAULT_TIMEOUT_MS = 3000

function normalizeText(value) {
  return String(value || '').trim()
}

function normalizeWord(value) {
  return normalizeText(value).toLowerCase()
}

function extractNestedText(node) {
  if (typeof node === 'string') {
    return [node]
  }

  if (Array.isArray(node)) {
    return node.flatMap(item => extractNestedText(item))
  }

  if (!node || typeof node !== 'object') {
    return []
  }

  if ('i' in node) {
    return extractNestedText(node.i)
  }

  if ('l' in node) {
    return extractNestedText(node.l)
  }

  if ('tr' in node) {
    return extractNestedText(node.tr)
  }

  return []
}

function extractMeaningLines(trs) {
  if (!Array.isArray(trs)) {
    return []
  }

  return trs
    .flatMap(item => extractNestedText(item?.tr ?? item))
    .map(line => normalizeText(line))
    .filter(Boolean)
}

export function parseYoudaoWordMeaning(payload, fallbackWord = '') {
  const entry = payload?.ec?.word?.[0] || payload?.word?.[0] || null
  const word = extractNestedText(entry?.['return-phrase'])
    .map(item => normalizeWord(item))
    .find(Boolean) || normalizeWord(fallbackWord)
  const ukphone = normalizeText(entry?.ukphone)
  const usphone = normalizeText(entry?.usphone)
  const meanings = extractMeaningLines(entry?.trs)

  if (!word && !ukphone && !usphone && !meanings.length) {
    return null
  }

  return {
    word,
    ukphone,
    usphone,
    meanings
  }
}

export function formatWordleMeaningBlock(meaning) {
  if (!meaning) {
    return ''
  }

  const lines = []
  const word = normalizeWord(meaning.word)
  const ukphone = normalizeText(meaning.ukphone)
  const usphone = normalizeText(meaning.usphone)
  const meanings = Array.isArray(meaning.meanings)
    ? meaning.meanings.map(item => normalizeText(item)).filter(Boolean)
    : []

  if (word) {
    lines.push(word)
  }

  const pronunciationParts = []

  if (ukphone) {
    pronunciationParts.push(`英  / ${ukphone} /`)
  }

  if (usphone) {
    pronunciationParts.push(`美  / ${usphone} /`)
  }

  if (pronunciationParts.length) {
    lines.push(pronunciationParts.join('  '))
  }

  if (meanings.length) {
    if (lines.length) {
      lines.push('')
    }

    lines.push(...meanings)
  }

  return lines.join('\n')
}

export async function fetchWordleMeaning(word, options = {}) {
  const normalizedWord = normalizeWord(word)
  const fetchImpl = options.fetchImpl || globalThis.fetch
  const timeoutMs = Number.isInteger(options.timeoutMs) && options.timeoutMs > 0
    ? options.timeoutMs
    : DEFAULT_TIMEOUT_MS
  const onError = typeof options.onError === 'function' ? options.onError : null

  if (!normalizedWord || typeof fetchImpl !== 'function') {
    return null
  }

  try {
    const response = await fetchImpl(`${YOUDAO_ENDPOINT}?q=${encodeURIComponent(normalizedWord)}`, {
      method: 'GET',
      headers: {
        accept: 'application/json'
      },
      signal: options.signal || AbortSignal.timeout(timeoutMs)
    })

    if (!response?.ok) {
      throw new Error(`request failed with status ${response?.status ?? 'unknown'}`)
    }

    return parseYoudaoWordMeaning(await response.json(), normalizedWord)
  } catch (error) {
    onError?.(error)
    return null
  }
}
