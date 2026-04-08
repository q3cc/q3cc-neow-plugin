import { isBlockedSexualWord } from './blocked-words.js'

const YOUDAO_ENDPOINT = 'https://dict.youdao.com/jsonapi'
const YOUDAO_SUGGEST_ENDPOINT = 'http://dict.youdao.com/suggest'
const DEFAULT_TIMEOUT_MS = 3000

function normalizeText(value) {
  return String(value || '').trim()
}

function normalizeWord(value) {
  return normalizeText(value).toLowerCase()
}

function normalizeLookupQuery(value) {
  return String(value || '').trim()
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

function extractExamTypes(examTypes) {
  if (!Array.isArray(examTypes)) {
    return []
  }

  return examTypes
    .map(item => normalizeText(item))
    .filter(Boolean)
}

function extractWordForms(wfs) {
  if (!Array.isArray(wfs)) {
    return []
  }

  return wfs
    .map(item => ({
      name: normalizeText(item?.wf?.name),
      value: normalizeText(item?.wf?.value)
    }))
    .filter(item => item.name && item.value)
}

function buildPronunciationLine(meaning) {
  const pronunciationParts = []
  const ukphone = normalizeText(meaning?.ukphone)
  const usphone = normalizeText(meaning?.usphone)

  if (ukphone) {
    pronunciationParts.push(`英  / ${ukphone} /`)
  }

  if (usphone) {
    pronunciationParts.push(`美  / ${usphone} /`)
  }

  return pronunciationParts.join('  ')
}

export function parseYoudaoWordMeaning(payload, fallbackWord = '') {
  const entry = payload?.ec?.word?.[0] || payload?.word?.[0] || null
  const word = extractNestedText(entry?.['return-phrase'])
    .map(item => normalizeWord(item))
    .find(Boolean) || normalizeWord(fallbackWord)
  const ukphone = normalizeText(entry?.ukphone)
  const usphone = normalizeText(entry?.usphone)
  const meanings = extractMeaningLines(entry?.trs)
  const examTypes = extractExamTypes(payload?.ec?.exam_type)
  const wordForms = extractWordForms(entry?.wfs)

  if (!word && !ukphone && !usphone && !meanings.length && !examTypes.length && !wordForms.length) {
    return null
  }

  return {
    word,
    ukphone,
    usphone,
    meanings,
    examTypes,
    wordForms
  }
}

export function hasYoudaoWordDetails(meaning) {
  if (!meaning) {
    return false
  }

  return Boolean(
    normalizeText(meaning.ukphone)
    || normalizeText(meaning.usphone)
    || (Array.isArray(meaning.meanings) && meaning.meanings.some(item => normalizeText(item)))
    || (Array.isArray(meaning.examTypes) && meaning.examTypes.some(item => normalizeText(item)))
    || (Array.isArray(meaning.wordForms) && meaning.wordForms.some(item => normalizeText(item?.name) && normalizeText(item?.value)))
  )
}

function createRequestSignal(options, timeoutMs) {
  return options.signal || AbortSignal.timeout(timeoutMs)
}

async function requestYoudaoJson(url, options = {}) {
  const fetchImpl = options.fetchImpl || globalThis.fetch
  const timeoutMs = Number.isInteger(options.timeoutMs) && options.timeoutMs > 0
    ? options.timeoutMs
    : DEFAULT_TIMEOUT_MS
  const onError = typeof options.onError === 'function' ? options.onError : null

  if (typeof fetchImpl !== 'function') {
    return null
  }

  try {
    const response = await fetchImpl(url, {
      method: 'GET',
      headers: {
        accept: 'application/json'
      },
      signal: createRequestSignal(options, timeoutMs)
    })

    if (!response?.ok) {
      throw new Error(`request failed with status ${response?.status ?? 'unknown'}`)
    }

    return await response.json()
  } catch (error) {
    onError?.(error)
    return null
  }
}

export function formatWordleMeaningBlock(meaning) {
  if (!hasYoudaoWordDetails(meaning)) {
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

  const pronunciationLine = buildPronunciationLine({
    ukphone,
    usphone
  })

  if (pronunciationLine) {
    lines.push(pronunciationLine)
  }

  if (meanings.length) {
    if (lines.length) {
      lines.push('')
    }

    lines.push(...meanings)
  }

  return lines.join('\n')
}

export function formatWordLookupBlock(meaning) {
  if (!hasYoudaoWordDetails(meaning)) {
    return ''
  }

  const lines = []
  const word = normalizeWord(meaning.word)
  const meanings = Array.isArray(meaning.meanings)
    ? meaning.meanings.map(item => normalizeText(item)).filter(Boolean)
    : []
  const examTypes = Array.isArray(meaning.examTypes)
    ? meaning.examTypes.map(item => normalizeText(item)).filter(Boolean)
    : []
  const wordForms = Array.isArray(meaning.wordForms)
    ? meaning.wordForms.filter(item => normalizeText(item?.name) && normalizeText(item?.value))
    : []
  const pronunciationLine = buildPronunciationLine(meaning)

  if (word) {
    lines.push(word)
  }

  if (pronunciationLine) {
    lines.push(pronunciationLine)
  }

  const detailLines = [
    ...meanings,
    ...(examTypes.length ? [examTypes.join(' / ')] : []),
    ...(wordForms.length ? [wordForms.map(item => `${normalizeText(item.name)} ${normalizeText(item.value)}`).join('  ')] : [])
  ]

  if (detailLines.length) {
    if (lines.length) {
      lines.push('')
    }

    lines.push(...detailLines)
  }

  return lines.join('\n')
}

export function parseYoudaoSuggestions(payload, fallbackQuery = '') {
  const query = normalizeLookupQuery(payload?.data?.query || fallbackQuery)
  const entries = payload?.result?.code === 200 && Array.isArray(payload?.data?.entries)
    ? payload.data.entries
      .map(item => ({
        entry: normalizeLookupQuery(item?.entry),
        explain: normalizeText(item?.explain)
      }))
      .filter(item => item.entry)
      .filter(item => !isBlockedSexualWord(item.entry))
      .slice(0, 5)
    : []

  return {
    query,
    entries
  }
}

export function formatWordSuggestionBlock(result) {
  if (!Array.isArray(result?.entries) || result.entries.length === 0) {
    return ''
  }

  const title = result.query ? `搜索结果：${result.query}` : '搜索结果'

  return [
    title,
    '',
    ...result.entries.map((item, index) => item.explain
      ? `${index + 1}. ${item.entry} - ${item.explain}`
      : `${index + 1}. ${item.entry}`)
  ].join('\n')
}

export async function fetchWordleMeaning(word, options = {}) {
  const normalizedWord = normalizeWord(word)

  if (!normalizedWord) {
    return null
  }

  const payload = await requestYoudaoJson(`${YOUDAO_ENDPOINT}?q=${encodeURIComponent(normalizedWord)}`, options)
  return payload ? parseYoudaoWordMeaning(payload, normalizedWord) : null
}

export async function fetchWordSuggestions(query, options = {}) {
  const normalizedQuery = normalizeLookupQuery(query)

  if (!normalizedQuery) {
    return {
      query: '',
      entries: []
    }
  }

  const payload = await requestYoudaoJson(
    `${YOUDAO_SUGGEST_ENDPOINT}?num=5&ver=3.0&doctype=json&cache=false&le=en&q=${encodeURIComponent(normalizedQuery)}`,
    options
  )

  return parseYoudaoSuggestions(payload, normalizedQuery)
}
