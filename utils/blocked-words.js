const BLOCKED_WORDS = new Set([
  'ANAL',
  'BOOB',
  'BOOBS',
  'COCK',
  'COCKS',
  'DICK',
  'DICKS',
  'DILDO',
  'FUCK',
  'FUCKS',
  'HORNY',
  'NUDE',
  'NUDES',
  'PENIS',
  'PORN',
  'PORNO',
  'PORNS',
  'PORNY',
  'PUSSY',
  'SEX',
  'SEXED',
  'SEXER',
  'SEXES',
  'SEXTO',
  'SEXTS',
  'SEXY',
  'SLUT',
  'SLUTS',
  'SPERM',
  'TITS',
  'TITTY',
  'VAGINA',
  'WHORE'
])

export function normalizeBlockedWord(word) {
  return String(word || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
}

export function isBlockedSexualWord(word) {
  const normalizedWord = normalizeBlockedWord(word)
  return Boolean(normalizedWord) && BLOCKED_WORDS.has(normalizedWord)
}

export function filterBlockedWords(words = []) {
  return (Array.isArray(words) ? words : []).filter(word => !isBlockedSexualWord(word))
}

export function getBlockedSexualWords() {
  return [...BLOCKED_WORDS]
}
