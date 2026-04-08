import test from 'node:test'
import assert from 'node:assert/strict'

import {
  fetchWordSuggestions,
  fetchWordleMeaning,
  formatWordSuggestionBlock,
  formatWordLookupBlock,
  formatWordleMeaningBlock,
  hasYoudaoWordDetails,
  parseYoudaoSuggestions,
  parseYoudaoWordMeaning
} from '../utils/wordle-dict.js'

test('parseYoudaoWordMeaning and formatWordleMeaningBlock support the arise sample', () => {
  const payload = {
    ec: {
      exam_type: [
        '高中',
        'CET4',
        'CET6',
        '考研',
        '商务英语'
      ],
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
          ],
          wfs: [
            {
              wf: {
                name: '第三人称单数',
                value: 'arises'
              }
            },
            {
              wf: {
                name: '现在分词',
                value: 'arising'
              }
            },
            {
              wf: {
                name: '过去式',
                value: 'arose'
              }
            },
            {
              wf: {
                name: '过去分词',
                value: 'arisen'
              }
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
    ],
    examTypes: ['高中', 'CET4', 'CET6', '考研', '商务英语'],
    wordForms: [
      { name: '第三人称单数', value: 'arises' },
      { name: '现在分词', value: 'arising' },
      { name: '过去式', value: 'arose' },
      { name: '过去分词', value: 'arisen' }
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

  assert.equal(
    formatWordLookupBlock(meaning),
    [
      'arise',
      '英  / əˈraɪz /  美  / əˈraɪz /',
      '',
      'v. 产生，出现；起源（于），由……引出；起床，起立；上升',
      '【名】 （Arise）（英、美、德、印）阿里塞',
      '高中 / CET4 / CET6 / 考研 / 商务英语',
      '第三人称单数 arises  现在分词 arising  过去式 arose  过去分词 arisen'
    ].join('\n')
  )
})

test('formatWordleMeaningBlock omits empty placeholders', () => {
  assert.equal(
    formatWordleMeaningBlock({
      word: 'crane',
      ukphone: '',
      usphone: '',
      meanings: [],
      examTypes: [],
      wordForms: []
    }),
    ''
  )

  assert.equal(
    formatWordleMeaningBlock({
      word: '',
      ukphone: 'kreɪn',
      usphone: '',
      meanings: ['n. 鹤；起重机'],
      examTypes: [],
      wordForms: []
    }),
    [
      '英  / kreɪn /',
      '',
      'n. 鹤；起重机'
    ].join('\n')
  )
})

test('parseYoudaoWordMeaning safely degrades on incomplete payloads', () => {
  const fallbackMeaning = parseYoudaoWordMeaning({}, 'SLATE')

  assert.deepEqual(fallbackMeaning, {
    word: 'slate',
    ukphone: '',
    usphone: '',
    meanings: [],
    examTypes: [],
    wordForms: []
  })
  assert.equal(hasYoudaoWordDetails(fallbackMeaning), false)
  assert.equal(formatWordLookupBlock(fallbackMeaning), '')
  assert.equal(formatWordleMeaningBlock(fallbackMeaning), '')

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
              exam_type: ['CET4'],
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
                  ],
                  wfs: [
                    {
                      wf: {
                        name: '过去式',
                        value: 'arose'
                      }
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
    meanings: ['v. 产生，出现'],
    examTypes: ['CET4'],
    wordForms: [
      {
        name: '过去式',
        value: 'arose'
      }
    ]
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

test('parseYoudaoSuggestions supports chinese search results', () => {
  const result = parseYoudaoSuggestions({
    result: {
      msg: 'success',
      code: 200
    },
    data: {
      query: '原神',
      entries: [
        {
          entry: '原神',
          explain: 'Genshin Impact'
        },
        {
          entry: '原神星族',
          explain: 'Cybele asteroids'
        },
        {
          entry: '厨神',
          explain: 'Auguste Gusteau'
        }
      ]
    }
  })

  assert.deepEqual(result, {
    query: '原神',
    entries: [
      { entry: '原神', explain: 'Genshin Impact' },
      { entry: '原神星族', explain: 'Cybele asteroids' },
      { entry: '厨神', explain: 'Auguste Gusteau' }
    ]
  })
})

test('parseYoudaoSuggestions supports english search results and filters blocked words', () => {
  const result = parseYoudaoSuggestions({
    result: {
      msg: 'success',
      code: 200
    },
    data: {
      query: 'game',
      entries: [
        {
          entry: 'game',
          explain: 'n. 游戏，比赛'
        },
        {
          entry: 'games',
          explain: 'n. 游戏（game 的复数）'
        },
        {
          entry: 'dicks',
          explain: 'blocked'
        },
        {
          entry: 'gameplay',
          explain: 'n. 游戏设置'
        }
      ]
    }
  })

  assert.deepEqual(result, {
    query: 'game',
    entries: [
      { entry: 'game', explain: 'n. 游戏，比赛' },
      { entry: 'games', explain: 'n. 游戏（game 的复数）' },
      { entry: 'gameplay', explain: 'n. 游戏设置' }
    ]
  })
})

test('formatWordSuggestionBlock builds numbered search results', () => {
  assert.equal(
    formatWordSuggestionBlock({
      query: 'game',
      entries: [
        { entry: 'game', explain: 'n. 游戏，比赛' },
        { entry: 'games', explain: '' }
      ]
    }),
    [
      '搜索结果：game',
      '',
      '1. game - n. 游戏，比赛',
      '2. games'
    ].join('\n')
  )
})

test('fetchWordSuggestions requests suggest endpoint and parses results', async () => {
  let requestedUrl = ''

  const result = await fetchWordSuggestions('原神', {
    fetchImpl: async url => {
      requestedUrl = url
      return {
        ok: true,
        async json() {
          return {
            result: {
              msg: 'success',
              code: 200
            },
            data: {
              query: '原神',
              entries: [
                {
                  entry: '原神',
                  explain: 'Genshin Impact'
                },
                {
                  entry: '厨神',
                  explain: 'Auguste Gusteau'
                }
              ]
            }
          }
        }
      }
    }
  })

  assert.equal(requestedUrl, 'http://dict.youdao.com/suggest?num=5&ver=3.0&doctype=json&cache=false&le=en&q=%E5%8E%9F%E7%A5%9E')
  assert.deepEqual(result, {
    query: '原神',
    entries: [
      { entry: '原神', explain: 'Genshin Impact' },
      { entry: '厨神', explain: 'Auguste Gusteau' }
    ]
  })
})

test('fetchWordSuggestions returns empty results on not found payload', async () => {
  const result = await fetchWordSuggestions('asdfghjkl', {
    fetchImpl: async () => ({
      ok: true,
      async json() {
        return {
          result: {
            msg: 'not found',
            code: 404
          },
          data: {}
        }
      }
    })
  })

  assert.deepEqual(result, {
    query: 'asdfghjkl',
    entries: []
  })
  assert.equal(formatWordSuggestionBlock(result), '')
})
