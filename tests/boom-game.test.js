import test from 'node:test'
import assert from 'node:assert/strict'

import {
  BOOM_COUNTDOWN_MS,
  BOOM_DIFFICULTIES,
  BOOM_GUESS_MAX,
  BOOM_GUESS_MIN,
  BOOM_ROOM_IDLE_MS,
  addBoomPlayer,
  applyBoomGuess,
  createBoomRoom,
  deleteBoomRoom,
  getBoomCurrentPlayerId,
  getBoomGuessRange,
  getBoomRoom,
  isBoomCountdownActive,
  isBoomRoomIdleActive,
  prepareBoomStart,
  rollBoomStake,
  setBoomCountdown,
  setBoomRoomIdle,
  settleBoomRoom,
  startBoomGame
} from '../utils/boom-game.js'

function createSequenceRandom(values) {
  let index = 0

  return () => {
    const value = values[index]
    index = Math.min(index + 1, values.length - 1)
    return value
  }
}

test('rollBoomStake stays within configured range and below 15', () => {
  for (const [difficultyId, difficulty] of Object.entries(BOOM_DIFFICULTIES)) {
    const minStake = rollBoomStake(Number(difficultyId), () => 0)
    const maxStake = rollBoomStake(Number(difficultyId), () => 0.999999)

    assert.equal(minStake, difficulty.stakeRange[0])
    assert.equal(maxStake, difficulty.stakeRange[1])
    assert.ok(minStake < 15)
    assert.ok(maxStake < 15)
  }
})

test('countdown metadata can be written to room state', () => {
  const room = createBoomRoom('countdown-room', 10001, '1', 1)
  const timer = setTimeout(() => {}, 1)

  const countdownToken = setBoomCountdown(room, timer, BOOM_COUNTDOWN_MS, 1000)

  assert.equal(room.status, 'countdown')
  assert.equal(room.countdownEndsAt, 1000 + BOOM_COUNTDOWN_MS)
  assert.equal(room.countdownToken, countdownToken)
  assert.equal(isBoomCountdownActive('countdown-room', room.roomId, countdownToken), true)

  clearTimeout(timer)
  deleteBoomRoom('countdown-room')
})

test('stale countdown tokens do not match recreated rooms in the same session', () => {
  const oldRoom = createBoomRoom('race-room', 10007, '1', 1)
  const oldToken = setBoomCountdown(oldRoom, null, BOOM_COUNTDOWN_MS, 1000)
  const oldRoomId = oldRoom.roomId

  deleteBoomRoom('race-room')

  const newRoom = createBoomRoom('race-room', 10007, '2', 1)
  const newToken = setBoomCountdown(newRoom, null, BOOM_COUNTDOWN_MS, 1000)

  assert.equal(isBoomCountdownActive('race-room', oldRoomId, oldToken), false)
  assert.equal(isBoomCountdownActive('race-room', newRoom.roomId, newToken), true)
  assert.equal(getBoomRoom('race-room')?.roomId, newRoom.roomId)

  deleteBoomRoom('race-room')
})

test('stale room idle tokens do not match recreated rooms in the same session', () => {
  const oldRoom = createBoomRoom('idle-room', 10008, '1', 1)
  const oldToken = setBoomRoomIdle(oldRoom, null, BOOM_ROOM_IDLE_MS, 1000)
  const oldRoomId = oldRoom.roomId

  deleteBoomRoom('idle-room')

  const newRoom = createBoomRoom('idle-room', 10008, '2', 1)
  const newToken = setBoomRoomIdle(newRoom, null, BOOM_ROOM_IDLE_MS, 1000)

  assert.equal(isBoomRoomIdleActive('idle-room', oldRoomId, oldToken), false)
  assert.equal(isBoomRoomIdleActive('idle-room', newRoom.roomId, newToken), true)
  assert.equal(getBoomRoom('idle-room')?.roomId, newRoom.roomId)

  deleteBoomRoom('idle-room')
})

test('prepareBoomStart removes players under 40 coins and keeps eligible players', () => {
  const room = createBoomRoom('prepare-room', 10002, '1', 1)
  addBoomPlayer(room, '2', 0)
  addBoomPlayer(room, '3', 3)

  const result = prepareBoomStart(
    room,
    userId => ({ 1: 100, 2: 35, 3: 120 })[userId] || 0,
    createSequenceRandom([0, 0.5, 0.999999])
  )

  assert.equal(result.canStart, true)
  assert.deepEqual(result.removedPlayers.map(player => player.userId), ['2'])
  assert.equal(room.players.length, 2)
  assert.deepEqual(room.players.map(player => player.userId), ['1', '3'])
  assert.ok(room.players.every(player => player.actualStake > 0 && player.actualStake < 15))
  assert.equal(room.prizePool, room.players[0].actualStake + room.players[1].actualStake)

  deleteBoomRoom('prepare-room')
})

test('prepareBoomStart cancels when fewer than two eligible players remain', () => {
  const room = createBoomRoom('cancel-room', 10003, '1', 1)
  addBoomPlayer(room, '2', 2)

  const result = prepareBoomStart(
    room,
    userId => ({ 1: 100, 2: 12 })[userId] || 0,
    () => 0.5
  )

  assert.equal(result.canStart, false)
  assert.deepEqual(result.removedPlayers.map(player => player.userId), ['2'])
  assert.equal(room.players.length, 1)

  deleteBoomRoom('cancel-room')
})

test('startBoomGame initializes turn order, bomb and bounds', () => {
  const room = createBoomRoom('start-room', 10004, '1', 1)
  addBoomPlayer(room, '2', 1)
  addBoomPlayer(room, '3', 1)

  prepareBoomStart(room, () => 100, () => 0)
  startBoomGame(room, () => 0)

  assert.equal(room.status, 'active')
  assert.equal(room.bombNumber, BOOM_GUESS_MIN)
  assert.equal(room.lowerBound, 0)
  assert.equal(room.upperBound, BOOM_GUESS_MAX + 1)
  assert.equal(room.turnOrder.length, 3)
  assert.equal(new Set(room.turnOrder).size, 3)
  assert.ok(getBoomCurrentPlayerId(room))

  deleteBoomRoom('start-room')
})

test('applyBoomGuess shrinks bounds and advances turn order', () => {
  const room = createBoomRoom('guess-room', 10005, '1', 1)
  addBoomPlayer(room, '2', 1)
  addBoomPlayer(room, '3', 1)

  prepareBoomStart(room, () => 100, () => 0)
  room.status = 'active'
  room.turnOrder = ['1', '2', '3']
  room.currentTurnIndex = 0
  room.lowerBound = 0
  room.upperBound = 101
  room.bombNumber = 70

  const firstGuess = applyBoomGuess(room, '1', 40)
  assert.equal(firstGuess.ok, true)
  assert.equal(firstGuess.result, 'safe')
  assert.equal(firstGuess.direction, 'higher')
  assert.equal(room.lowerBound, 40)
  assert.equal(getBoomCurrentPlayerId(room), '2')
  assert.deepEqual(getBoomGuessRange(room), { min: 41, max: 100 })

  const secondGuess = applyBoomGuess(room, '2', 88)
  assert.equal(secondGuess.ok, true)
  assert.equal(secondGuess.direction, 'lower')
  assert.equal(room.upperBound, 88)
  assert.equal(getBoomCurrentPlayerId(room), '3')

  deleteBoomRoom('guess-room')
})

test('settleBoomRoom splits prize pool and distributes remainder from next player', () => {
  const room = createBoomRoom('settle-room', 10006, '1', 1)
  addBoomPlayer(room, '2', 1)
  addBoomPlayer(room, '3', 1)
  addBoomPlayer(room, '4', 1)

  room.status = 'active'
  room.turnOrder = ['1', '2', '3', '4']
  room.currentTurnIndex = 1
  room.prizePool = 29

  const result = settleBoomRoom(room, '2')

  assert.deepEqual(result.winnerIds, ['1', '3', '4'])
  assert.equal(result.baseReward, 9)
  assert.equal(result.remainder, 2)
  assert.deepEqual(result.payoutOrder, ['3', '4', '1'])
  assert.deepEqual(result.payouts, {
    1: 9,
    3: 10,
    4: 10
  })

  deleteBoomRoom('settle-room')
})
