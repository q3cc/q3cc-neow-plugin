export const BOOM_MIN_COINS = 40
export const BOOM_MAX_PLAYERS = 8
export const BOOM_COUNTDOWN_MS = 15000
export const BOOM_ROOM_IDLE_MS = 30 * 60 * 1000
export const BOOM_GUESS_MIN = 1
export const BOOM_GUESS_MAX = 100

export const BOOM_DIFFICULTIES = {
  0: {
    name: '简单',
    stakeLabel: 10,
    stakeRange: [3, 6]
  },
  1: {
    name: '普通',
    stakeLabel: 20,
    stakeRange: [5, 8]
  },
  2: {
    name: '困难',
    stakeLabel: 30,
    stakeRange: [7, 11]
  },
  3: {
    name: '极限',
    stakeLabel: 40,
    stakeRange: [9, 14]
  }
}

const boomRooms = new Map()
let nextBoomRoomId = 1
let nextBoomCountdownToken = 1
let nextBoomRoomIdleToken = 1

function normalizeSessionId(sessionId) {
  return String(sessionId)
}

function normalizeUserId(userId) {
  return String(userId)
}

function rollInt(min, max, random = Math.random) {
  return Math.floor(random() * (max - min + 1)) + min
}

function shuffle(items, random = Math.random) {
  const cloned = [...items]

  for (let i = cloned.length - 1; i > 0; i--) {
    const target = Math.floor(random() * (i + 1))
    ;[cloned[i], cloned[target]] = [cloned[target], cloned[i]]
  }

  return cloned
}

function getDifficulty(difficultyId) {
  return BOOM_DIFFICULTIES[difficultyId] || BOOM_DIFFICULTIES[1]
}

export function createBoomPlayer(userId, difficultyId = 1) {
  const difficulty = getDifficulty(difficultyId)

  return {
    userId: normalizeUserId(userId),
    difficulty: Number.isInteger(difficultyId) ? difficultyId : 1,
    difficultyName: difficulty.name,
    actualStake: 0,
    eliminated: false
  }
}

export function getBoomRoom(sessionId) {
  return boomRooms.get(normalizeSessionId(sessionId))
}

export function createBoomRoom(sessionId, groupId, hostId, difficultyId = 1) {
  const room = {
    roomId: nextBoomRoomId++,
    sessionId: normalizeSessionId(sessionId),
    groupId: Number(groupId) || 0,
    status: 'lobby',
    hostId: normalizeUserId(hostId),
    players: [createBoomPlayer(hostId, difficultyId)],
    countdownEndsAt: 0,
    countdownTimer: null,
    countdownToken: 0,
    roomIdleEndsAt: 0,
    roomIdleTimer: null,
    roomIdleToken: 0,
    turnOrder: [],
    currentTurnIndex: 0,
    lowerBound: 0,
    upperBound: 101,
    bombNumber: 0,
    prizePool: 0
  }

  boomRooms.set(room.sessionId, room)
  return room
}

export function clearBoomCountdown(room, resetStatus = true) {
  if (!room) {
    return null
  }

  if (room.countdownTimer) {
    clearTimeout(room.countdownTimer)
  }

  room.countdownTimer = null
  room.countdownEndsAt = 0
  room.countdownToken = 0

  if (resetStatus && room.status === 'countdown') {
    room.status = 'lobby'
  }

  return room
}

export function clearBoomRoomIdle(room) {
  if (!room) {
    return null
  }

  if (room.roomIdleTimer) {
    clearTimeout(room.roomIdleTimer)
  }

  room.roomIdleTimer = null
  room.roomIdleEndsAt = 0
  room.roomIdleToken = 0
  return room
}

export function deleteBoomRoom(sessionId) {
  const normalized = normalizeSessionId(sessionId)
  const room = boomRooms.get(normalized)

  if (room) {
    clearBoomCountdown(room, false)
    clearBoomRoomIdle(room)
  }

  boomRooms.delete(normalized)
}

export function setBoomCountdown(room, timer, delayMs = BOOM_COUNTDOWN_MS, now = Date.now()) {
  clearBoomCountdown(room)
  room.status = 'countdown'
  room.countdownTimer = timer || null
  room.countdownEndsAt = now + delayMs
  room.countdownToken = nextBoomCountdownToken++
  return room.countdownToken
}

export function isBoomCountdownActive(sessionId, roomId, countdownToken) {
  const room = getBoomRoom(sessionId)
  return Boolean(
    room &&
    room.status === 'countdown' &&
    room.roomId === roomId &&
    room.countdownToken === countdownToken
  )
}

export function setBoomRoomIdle(room, timer, delayMs = BOOM_ROOM_IDLE_MS, now = Date.now()) {
  clearBoomRoomIdle(room)
  room.roomIdleTimer = timer || null
  room.roomIdleEndsAt = now + delayMs
  room.roomIdleToken = nextBoomRoomIdleToken++
  return room.roomIdleToken
}

export function isBoomRoomIdleActive(sessionId, roomId, roomIdleToken) {
  const room = getBoomRoom(sessionId)
  return Boolean(
    room &&
    room.status !== 'active' &&
    room.roomId === roomId &&
    room.roomIdleToken === roomIdleToken
  )
}

export function getBoomPlayer(room, userId) {
  if (!room) {
    return null
  }

  const normalizedUserId = normalizeUserId(userId)
  return room.players.find(player => player.userId === normalizedUserId) || null
}

export function isBoomParticipant(room, userId) {
  return Boolean(getBoomPlayer(room, userId))
}

export function addBoomPlayer(room, userId, difficultyId = 1) {
  if (!room || isBoomParticipant(room, userId) || room.players.length >= BOOM_MAX_PLAYERS) {
    return null
  }

  const player = createBoomPlayer(userId, difficultyId)
  room.players.push(player)
  return player
}

export function removeBoomPlayer(room, userId) {
  if (!room) {
    return {
      removedPlayer: null,
      newHostId: null
    }
  }

  const normalizedUserId = normalizeUserId(userId)
  const index = room.players.findIndex(player => player.userId === normalizedUserId)
  if (index === -1) {
    return {
      removedPlayer: null,
      newHostId: null
    }
  }

  const [removedPlayer] = room.players.splice(index, 1)
  let newHostId = null

  if (room.hostId === removedPlayer.userId) {
    room.hostId = room.players[0]?.userId || ''
    newHostId = room.hostId || null
  }

  return {
    removedPlayer,
    newHostId
  }
}

export function rollBoomStake(difficultyId, random = Math.random) {
  const difficulty = getDifficulty(difficultyId)
  const [min, max] = difficulty.stakeRange
  return rollInt(min, max, random)
}

export function prepareBoomStart(room, getCoinsByUserId, random = Math.random) {
  if (!room) {
    return {
      canStart: false,
      removedPlayers: [],
      hostTransferredTo: null
    }
  }

  clearBoomCountdown(room)

  const removedPlayers = []
  const remainedPlayers = []

  for (const player of room.players) {
    const coins = Number(getCoinsByUserId(player.userId)) || 0
    if (coins < BOOM_MIN_COINS) {
      removedPlayers.push(player)
      continue
    }

    player.actualStake = rollBoomStake(player.difficulty, random)
    player.eliminated = false
    remainedPlayers.push(player)
  }

  room.players = remainedPlayers
  room.prizePool = remainedPlayers.reduce((sum, player) => sum + player.actualStake, 0)

  let hostTransferredTo = null
  if (!room.players.some(player => player.userId === room.hostId)) {
    room.hostId = room.players[0]?.userId || ''
    hostTransferredTo = room.hostId || null
  }

  if (room.players.length < 2) {
    return {
      canStart: false,
      removedPlayers,
      hostTransferredTo,
      prizePool: room.prizePool
    }
  }

  return {
    canStart: true,
    removedPlayers,
    hostTransferredTo,
    prizePool: room.prizePool
  }
}

export function startBoomGame(room, random = Math.random) {
  if (!room) {
    return null
  }

  clearBoomRoomIdle(room)
  room.status = 'active'
  room.lowerBound = BOOM_GUESS_MIN - 1
  room.upperBound = BOOM_GUESS_MAX + 1
  room.bombNumber = rollInt(BOOM_GUESS_MIN, BOOM_GUESS_MAX, random)
  room.turnOrder = shuffle(room.players.map(player => player.userId), random)
  room.currentTurnIndex = 0
  return room
}

export function getBoomCurrentPlayerId(room) {
  if (!room?.turnOrder?.length) {
    return null
  }

  return room.turnOrder[room.currentTurnIndex] || null
}

export function getBoomGuessRange(room) {
  return {
    min: room.lowerBound + 1,
    max: room.upperBound - 1
  }
}

export function applyBoomGuess(room, userId, guess) {
  if (!room || room.status !== 'active') {
    return {
      ok: false,
      reason: 'not_active'
    }
  }

  const normalizedUserId = normalizeUserId(userId)
  const currentPlayerId = getBoomCurrentPlayerId(room)

  if (currentPlayerId !== normalizedUserId) {
    return {
      ok: false,
      reason: 'not_turn',
      currentPlayerId
    }
  }

  if (!Number.isInteger(guess)) {
    return {
      ok: false,
      reason: 'invalid_guess'
    }
  }

  if (guess <= room.lowerBound || guess >= room.upperBound) {
    return {
      ok: false,
      reason: 'out_of_range',
      range: getBoomGuessRange(room)
    }
  }

  if (guess === room.bombNumber) {
    const player = getBoomPlayer(room, normalizedUserId)
    if (player) {
      player.eliminated = true
    }

    return {
      ok: true,
      result: 'boom',
      loserId: normalizedUserId,
      guess
    }
  }

  if (guess < room.bombNumber) {
    room.lowerBound = guess
  } else {
    room.upperBound = guess
  }

  room.currentTurnIndex = (room.currentTurnIndex + 1) % room.turnOrder.length

  return {
    ok: true,
    result: 'safe',
    guess,
    direction: guess < room.bombNumber ? 'higher' : 'lower',
    nextPlayerId: getBoomCurrentPlayerId(room),
    range: getBoomGuessRange(room)
  }
}

export function settleBoomRoom(room, loserId) {
  const normalizedLoserId = normalizeUserId(loserId)
  const winnerIds = room.turnOrder.filter(playerId => playerId !== normalizedLoserId)
  const payouts = {}

  if (!winnerIds.length) {
    return {
      loserId: normalizedLoserId,
      winnerIds: [],
      payouts,
      baseReward: 0,
      remainder: 0,
      payoutOrder: []
    }
  }

  const baseReward = Math.floor(room.prizePool / winnerIds.length)
  const remainder = room.prizePool % winnerIds.length
  const loserIndex = room.turnOrder.indexOf(normalizedLoserId)
  const payoutOrder = []

  for (const winnerId of winnerIds) {
    payouts[winnerId] = baseReward
  }

  for (let offset = 1; offset < room.turnOrder.length; offset++) {
    const playerId = room.turnOrder[(loserIndex + offset) % room.turnOrder.length]
    if (playerId !== normalizedLoserId) {
      payoutOrder.push(playerId)
    }
  }

  for (let index = 0; index < remainder; index++) {
    const playerId = payoutOrder[index]
    payouts[playerId] += 1
  }

  return {
    loserId: normalizedLoserId,
    winnerIds,
    payouts,
    baseReward,
    remainder,
    payoutOrder
  }
}
