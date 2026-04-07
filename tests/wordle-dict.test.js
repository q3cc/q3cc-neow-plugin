import test from 'node:test'
import assert from 'node:assert/strict'

import {
  fetchWordleMeaning,
  formatWordleMeaningBlock,
  parseYoudaoWordMeaning
} from '../utils/wordle-dict.js'

test('parseYoudaoWordMeaning and formatWordleMeaningBlock support the arise sample', () => {
  const payload = {
    ec: {
      word: [
        {
          usphone: 'əˈraɪz',
          ukphone: 'əˈraɪz',
          'return-phrase': {
            l: {
              i: 'arise'
            }
          },
          trs: [
            {
              tr: [
                {
                  l: {
                    i: [
                      'v. 产生，出现；起源（于），由……引出；起床，起立；上升'
                    ]
                  }
                }
              ]
            },
            {
              tr: [
                {
                  l: {
                    i: [
                      '【名】 （Arise）（英、美、德、印）阿里塞'
                    ]
                  }
                }
              ]
            }
          ]
        }
      ]
    }
  }

  const meaning = parseYoudaoWordMeaning(payload, 'ARISE')

  assert.deepEqual(meaning, {
    word: 'arise',
    ukphone: 'əˈraɪz',
    usphone: 'əˈraɪz',
    meanings: [
      'v. 产生，出现；起源（于），由……引出；起床，起立；上升',
      '【名】 （Arise）（英、美、德、印）阿里塞'
    ]
  })

  assert.equal(
    formatWordleMeaningBlock(meaning),
    [
      'arise',
      '英  / əˈraɪz /  美  / əˈraɪz /',
      '',
      'v. 产生，出现；起源（于），由……引出；起床，起立；上升',
      '【名】 （Arise）（英、美、德、印）阿里塞'
    ].join('\n')
  )
})

test('formatWordleMeaningBlock omits empty placeholders', () => {
  assert.equal(
    formatWordleMeaningBlock({
      word: 'crane',
      ukphone: '',
      usphone: '',
      meanings: []
    }),
    'crane'
  )

  assert.equal(
    formatWordleMeaningBlock({
      word: '',
      ukphone: 'kreɪn',
      usphone: '',
      meanings: ['n. 鹤；起重机']
    }),
    [
      '英  / kreɪn /',
      '',
      'n. 鹤；起重机'
    ].join('\n')
  )
})

test('parseYoudaoWordMeaning safely degrades on incomplete payloads', () => {
  assert.deepEqual(
    parseYoudaoWordMeaning({}, 'SLATE'),
    {
      word: 'slate',
      ukphone: '',
      usphone: '',
      meanings: []
    }
  )

  assert.equal(parseYoudaoWordMeaning(null, ''), null)
})

test('fetchWordleMeaning requests the lower-cased word and parses the response', async () => {
  let requestedUrl = ''
  const meaning = await fetchWordleMeaning('ARISE', {
    fetchImpl: async url => {
      requestedUrl = url
      return {
        ok: true,
        async json() {
          return {
            ec: {
              word: [
                {
                  'return-phrase': 'arise',
                  ukphone: 'əˈraɪz',
                  usphone: 'əˈraɪz',
                  trs: [
                    {
                      tr: [
                        {
                          l: {
                            i: ['v. 产生，出现']
                          }
                        }
                      ]
                    }
                  ]
                }
              ]
            }
          }
        }
      }
    }
  })

  assert.equal(requestedUrl, 'https://dict.youdao.com/jsonapi?q=arise')
  assert.deepEqual(meaning, {
    word: 'arise',
    ukphone: 'əˈraɪz',
    usphone: 'əˈraɪz',
    meanings: ['v. 产生，出现']
  })
})

test('fetchWordleMeaning returns null and reports non-200 responses', async () => {
  const errors = []

  const meaning = await fetchWordleMeaning('arise', {
    fetchImpl: async () => ({
      ok: false,
      status: 503
    }),
    onError: error => errors.push(error.message)
  })

  assert.equal(meaning, null)
  assert.deepEqual(errors, ['request failed with status 503'])
})

test('fetchWordleMeaning returns null when the request throws', async () => {
  const errors = []

  const meaning = await fetchWordleMeaning('arise', {
    fetchImpl: async () => {
      throw new Error('timeout')
    },
    onError: error => errors.push(error.message)
  })

  assert.equal(meaning, null)
  assert.deepEqual(errors, ['timeout'])
})
