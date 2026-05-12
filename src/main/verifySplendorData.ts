import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import { mkdtempSync, rmSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { io as createClient, Socket } from 'socket.io-client';
import {
  DEVELOPMENT_CARD_COUNTS,
  GOLD_TOKEN_SUPPLY,
  TARGET_PRESTIGE_POINTS,
  TOKEN_SUPPLY_BY_PLAYER_COUNT,
  VISIBLE_CARDS_PER_LEVEL
} from '../shared/constants';
import {
  BASE_LEVEL_1_CARDS,
  BASE_LEVEL_2_CARDS,
  BASE_LEVEL_3_CARDS,
  BASE_NOBLES
} from '../shared/baseSet';
import { GameState, Room } from '../shared/types';
import { applyGameAction, initializeGame } from './gameLogic';
import { projectGameStateForViewer, startServer } from './server';

const EXPECTED_BASE_SET_HASH = 'db2f636f82d0df543a9e860e3cce449e3ccece67e24658654707d58a2c44938c';

function createRoom(playerCount: 2 | 3 | 4): Room {
  return {
    id: `room-${playerCount}`,
    name: `Verification Table ${playerCount}`,
    hostId: 'player-1',
    status: 'open',
    players: Array.from({ length: playerCount }, (_, index) => ({
      id: `player-${index + 1}`,
      name: `Player ${index + 1}`,
      isHost: index === 0,
      seat: index,
      joinedAt: '2026-01-01T00:00:00.000Z',
      connectionState: 'connected' as const
    })),
    gameState: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
  };
}

function assertPointDistribution(
  values: ReadonlyArray<{ points: number }>,
  expected: Record<number, number>,
  label: string
) {
  const actual = values.reduce<Record<number, number>>((accumulator, entry) => {
    accumulator[entry.points] = (accumulator[entry.points] ?? 0) + 1;
    return accumulator;
  }, {});

  assert.deepEqual(actual, expected, `${label} point distribution changed.`);
}

function verifyBaseSet() {
  assert.equal(BASE_LEVEL_1_CARDS.length, DEVELOPMENT_CARD_COUNTS.level1);
  assert.equal(BASE_LEVEL_2_CARDS.length, DEVELOPMENT_CARD_COUNTS.level2);
  assert.equal(BASE_LEVEL_3_CARDS.length, DEVELOPMENT_CARD_COUNTS.level3);
  assert.equal(BASE_NOBLES.length, 10);

  const ids = new Set<string>();
  for (const card of [...BASE_LEVEL_1_CARDS, ...BASE_LEVEL_2_CARDS, ...BASE_LEVEL_3_CARDS]) {
    assert(!ids.has(card.id), `Duplicate card id: ${card.id}`);
    ids.add(card.id);
    assert(card.points >= 0, `Card ${card.id} has a negative point value.`);
  }

  for (const noble of BASE_NOBLES) {
    assert(!ids.has(noble.id), `Noble id overlaps card id: ${noble.id}`);
    ids.add(noble.id);
    assert.equal(noble.points, 3, `Noble ${noble.id} should be worth 3 points.`);
  }

  assertPointDistribution(BASE_LEVEL_1_CARDS, { 0: 35, 1: 5 }, 'Level 1');
  assertPointDistribution(BASE_LEVEL_2_CARDS, { 1: 10, 2: 15, 3: 5 }, 'Level 2');
  assertPointDistribution(BASE_LEVEL_3_CARDS, { 3: 5, 4: 10, 5: 5 }, 'Level 3');

  const normalized = JSON.stringify({
    decks: {
      level1: BASE_LEVEL_1_CARDS,
      level2: BASE_LEVEL_2_CARDS,
      level3: BASE_LEVEL_3_CARDS
    },
    nobles: BASE_NOBLES
  });
  const hash = createHash('sha256').update(normalized).digest('hex');
  assert.equal(hash, EXPECTED_BASE_SET_HASH, 'Base set hash changed unexpectedly.');
}

function verifySetup(playerCount: 2 | 3 | 4) {
  const state = initializeGame(createRoom(playerCount));

  assert.equal(state.players.length, playerCount);
  assert.equal(state.phase, 'playing');
  assert.equal(state.turnNumber, 1);
  assert.equal(state.targetScore, TARGET_PRESTIGE_POINTS);
  assert.equal(state.finalRoundStartsAtPlayerId, null);
  assert.equal(state.nobles.length, playerCount + 1);

  assert.equal(state.visibleCards.level1.length, VISIBLE_CARDS_PER_LEVEL);
  assert.equal(state.visibleCards.level2.length, VISIBLE_CARDS_PER_LEVEL);
  assert.equal(state.visibleCards.level3.length, VISIBLE_CARDS_PER_LEVEL);

  assert.equal(
    state.decks.level1.length,
    DEVELOPMENT_CARD_COUNTS.level1 - VISIBLE_CARDS_PER_LEVEL
  );
  assert.equal(
    state.decks.level2.length,
    DEVELOPMENT_CARD_COUNTS.level2 - VISIBLE_CARDS_PER_LEVEL
  );
  assert.equal(
    state.decks.level3.length,
    DEVELOPMENT_CARD_COUNTS.level3 - VISIBLE_CARDS_PER_LEVEL
  );

  for (const color of ['diamond', 'sapphire', 'emerald', 'ruby', 'onyx'] as const) {
    assert.equal(
      state.gemSupply[color],
      TOKEN_SUPPLY_BY_PLAYER_COUNT[playerCount],
      `Gem supply for ${color} is wrong in a ${playerCount}-player game.`
    );
  }
  assert.equal(state.gemSupply.gold, GOLD_TOKEN_SUPPLY);

  for (const player of state.players) {
    assert.equal(player.points, 0);
    assert.equal(player.reservedCards.length, 0);
    assert.equal(player.purchasedCards.length, 0);
    assert.equal(player.nobles.length, 0);
    assert.equal(player.tokens.gold, 0);
  }
}

function fundPlayerForCard(
  player: ReturnType<typeof initializeGame>['players'][number],
  card: (typeof BASE_LEVEL_1_CARDS)[number]
) {
  for (const color of ['diamond', 'sapphire', 'emerald', 'ruby', 'onyx'] as const) {
    player.tokens[color] = Math.max(0, card.cost[color] - player.bonuses[color]);
  }
}

function verifyTakeDifferentTokensAction() {
  const state = initializeGame(createRoom(3));
  const activePlayer = state.players[0];

  applyGameAction(state, activePlayer.id, {
    type: 'take_three_distinct_tokens',
    colors: ['diamond', 'sapphire', 'emerald']
  });

  assert.equal(activePlayer.tokens.diamond, 1);
  assert.equal(activePlayer.tokens.sapphire, 1);
  assert.equal(activePlayer.tokens.emerald, 1);
  assert.equal(state.gemSupply.diamond, TOKEN_SUPPLY_BY_PLAYER_COUNT[3] - 1);
  assert.equal(state.currentPlayerIndex, 1);
}

function verifyTakeDifferentTokensValidation() {
  const state = initializeGame(createRoom(3));
  const activePlayer = state.players[0];

  assert.throws(() =>
    applyGameAction(state, activePlayer.id, {
      type: 'take_three_distinct_tokens',
      colors: ['diamond', 'diamond']
    })
  );

  assert.equal(state.players[0].tokens.diamond, 0);
  assert.equal(state.gemSupply.diamond, TOKEN_SUPPLY_BY_PLAYER_COUNT[3]);
  assert.equal(state.currentPlayerIndex, 0);

  state.gemSupply.sapphire = 0;
  assert.throws(() =>
    applyGameAction(state, activePlayer.id, {
      type: 'take_three_distinct_tokens',
      colors: ['sapphire']
    })
  );

  assert.equal(state.players[0].tokens.sapphire, 0);
  assert.equal(state.gemSupply.sapphire, 0);
  assert.equal(state.currentPlayerIndex, 0);
}

function verifyTakeTwoSameTokensValidation() {
  const state = initializeGame(createRoom(2));
  const activePlayer = state.players[0];
  state.gemSupply.diamond = 3;

  assert.throws(() =>
    applyGameAction(state, activePlayer.id, {
      type: 'take_two_same_tokens',
      color: 'diamond'
    })
  );
}

function verifyReserveCardAction() {
  const state = initializeGame(createRoom(3));
  const activePlayer = state.players[0];
  const cardToReserve = state.visibleCards.level1[0];
  const previousDeckSize = state.decks.level1.length;

  applyGameAction(state, activePlayer.id, {
    type: 'reserve_card',
    level: 1,
    cardId: cardToReserve.id,
    source: 'board'
  });

  assert.equal(activePlayer.reservedCards.length, 1);
  assert.equal(activePlayer.reservedCards[0].id, cardToReserve.id);
  assert.equal(activePlayer.reservedCards[0].card?.id, cardToReserve.id);
  assert.equal(activePlayer.tokens.gold, 1);
  assert.equal(state.gemSupply.gold, GOLD_TOKEN_SUPPLY - 1);
  assert.equal(state.visibleCards.level1.length, VISIBLE_CARDS_PER_LEVEL);
  assert.equal(state.decks.level1.length, previousDeckSize - 1);
  assert.equal(state.currentPlayerIndex, 1);
}

function verifyOverflowRequiresReturn() {
  const state = initializeGame(createRoom(3));
  const activePlayer = state.players[0];

  activePlayer.tokens.diamond = 2;
  activePlayer.tokens.sapphire = 2;
  activePlayer.tokens.emerald = 2;
  activePlayer.tokens.ruby = 2;
  activePlayer.tokens.onyx = 1;

  assert.equal(
    activePlayer.tokens.diamond +
      activePlayer.tokens.sapphire +
      activePlayer.tokens.emerald +
      activePlayer.tokens.ruby +
      activePlayer.tokens.onyx,
    9
  );

  assert.throws(() =>
    applyGameAction(state, activePlayer.id, {
      type: 'take_two_same_tokens',
      color: 'diamond'
    })
  );
}

function verifyOverflowReturnAction() {
  const state = initializeGame(createRoom(3));
  const activePlayer = state.players[0];

  activePlayer.tokens.diamond = 2;
  activePlayer.tokens.sapphire = 2;
  activePlayer.tokens.emerald = 2;
  activePlayer.tokens.ruby = 2;
  activePlayer.tokens.onyx = 1;

  applyGameAction(state, activePlayer.id, {
    type: 'take_two_same_tokens',
    color: 'diamond',
    returnedTokens: {
      onyx: 1
    }
  });

  assert.equal(activePlayer.tokens.diamond, 4);
  assert.equal(activePlayer.tokens.onyx, 0);
  assert.equal(
    activePlayer.tokens.diamond +
      activePlayer.tokens.sapphire +
      activePlayer.tokens.emerald +
      activePlayer.tokens.ruby +
      activePlayer.tokens.onyx +
      activePlayer.tokens.gold,
    10
  );
  assert.equal(state.gemSupply.diamond, TOKEN_SUPPLY_BY_PLAYER_COUNT[3] - 2);
  assert.equal(state.gemSupply.onyx, TOKEN_SUPPLY_BY_PLAYER_COUNT[3] + 1);
}

function verifyHiddenInformationProjection() {
  const state = initializeGame(createRoom(3));
  const reservingPlayer = state.players[0];
  const spectator = state.players[1];

  applyGameAction(state, reservingPlayer.id, {
    type: 'reserve_card',
    level: 3,
    source: 'deck'
  });

  const ownerView = projectGameStateForViewer(state, reservingPlayer.id);
  const spectatorView = projectGameStateForViewer(state, spectator.id);

  assert.equal(ownerView.players[0].reservedCards.length, 1);
  assert.equal(spectatorView.players[0].reservedCards.length, 1);
  assert(ownerView.players[0].reservedCards[0].card, 'Owner should see the reserved card details.');
  assert.equal(
    spectatorView.players[0].reservedCards[0].card,
    null,
    'Other players should not see the reserved deck-top card.'
  );
  assert.notEqual(
    spectatorView.players[0].reservedCards[0].id,
    ownerView.players[0].reservedCards[0].id,
    'Spectator should not see the real reserved card id.'
  );
  assert.equal(ownerView.decks.level3.length, state.decks.level3.length);
  assert.equal(spectatorView.decks.level3.length, state.decks.level3.length);
  assert.equal(ownerView.decks.level3[0].points, 0);
  assert.equal(spectatorView.decks.level3[0].points, 0);
}

function verifyPurchaseCardAction() {
  const state = initializeGame(createRoom(2));
  const activePlayer = state.players[0];
  const cardToBuy = state.visibleCards.level1[0];

  fundPlayerForCard(activePlayer, cardToBuy);

  applyGameAction(state, activePlayer.id, {
    type: 'purchase_card',
    level: 1,
    cardId: cardToBuy.id,
    source: 'board'
  });

  assert.equal(activePlayer.purchasedCards.length, 1);
  assert.equal(activePlayer.purchasedCards[0].id, cardToBuy.id);
  assert.equal(activePlayer.bonuses[cardToBuy.bonus], 1);
  assert.equal(activePlayer.points, cardToBuy.points);
  assert.equal(state.currentPlayerIndex, 1);
}

function verifyInvalidActionDoesNotMutateState() {
  const state = initializeGame(createRoom(3));
  const activePlayer = state.players[0];
  const visibleCard = state.visibleCards.level1[0];

  assert.throws(() =>
    applyGameAction(state, activePlayer.id, {
      type: 'take_three_distinct_tokens',
      colors: ['diamond'],
      returnedTokens: {
        diamond: 1
      }
    })
  );

  assert.equal(state.players[0].tokens.diamond, 0);
  assert.equal(state.gemSupply.diamond, TOKEN_SUPPLY_BY_PLAYER_COUNT[3]);
  assert.equal(state.currentPlayerIndex, 0);
  assert.equal(state.log.length, 0);

  assert.throws(() =>
    applyGameAction(state, activePlayer.id, {
      type: 'purchase_card',
      level: 1,
      cardId: visibleCard.id,
      source: 'board'
    })
  );

  assert.equal(state.visibleCards.level1[0].id, visibleCard.id);
  assert.equal(state.players[0].purchasedCards.length, 0);
  assert.equal(state.currentPlayerIndex, 0);
  assert.equal(state.log.length, 0);
}

function verifyNobleClaimAndFinalRound() {
  const state = initializeGame(createRoom(2));
  const activePlayer = state.players[0];
  const noble = state.nobles[0];
  const scoringCard = BASE_LEVEL_1_CARDS.find((card) => card.points === 1);
  assert(scoringCard, 'Expected at least one 1-point level 1 card in the base set.');

  state.visibleCards.level1[0] = scoringCard;
  for (const color of ['diamond', 'sapphire', 'emerald', 'ruby', 'onyx'] as const) {
    activePlayer.bonuses[color] = noble.requirement[color];
  }
  activePlayer.points = 14;
  fundPlayerForCard(activePlayer, scoringCard);

  applyGameAction(state, activePlayer.id, {
    type: 'purchase_card',
    level: 1,
    cardId: scoringCard.id,
    source: 'board'
  });

  assert.equal(activePlayer.nobles.length, 1);
  assert.equal(activePlayer.nobles[0].id, noble.id);
  assert.equal(state.phase, 'last_round');
  assert.equal(state.finalRoundStartsAtPlayerId, activePlayer.id);

  applyGameAction(state, state.players[1].id, {
    type: 'take_three_distinct_tokens',
    colors: ['diamond']
  });

  assert.equal(state.phase, 'finished');
  assert.deepEqual(state.winnerIds, [activePlayer.id]);
}

function verifyWinnerTieBreakerAndSharedWinners() {
  const tieBreakerState = initializeGame(createRoom(3));

  tieBreakerState.phase = 'last_round';
  tieBreakerState.finalRoundStartsAtPlayerId = tieBreakerState.players[0].id;
  tieBreakerState.currentPlayerIndex = 2;
  tieBreakerState.players[0].points = 15;
  tieBreakerState.players[0].purchasedCards = BASE_LEVEL_1_CARDS.slice(0, 5);
  tieBreakerState.players[1].points = 15;
  tieBreakerState.players[1].purchasedCards = BASE_LEVEL_1_CARDS.slice(0, 4);
  tieBreakerState.players[2].points = 14;

  applyGameAction(tieBreakerState, tieBreakerState.players[2].id, {
    type: 'take_three_distinct_tokens',
    colors: ['diamond']
  });

  assert.equal(tieBreakerState.phase, 'finished');
  assert.deepEqual(
    tieBreakerState.winnerIds,
    [tieBreakerState.players[1].id],
    'A tied player with fewer purchased cards should win.'
  );

  const sharedWinnerState = initializeGame(createRoom(3));

  sharedWinnerState.phase = 'last_round';
  sharedWinnerState.finalRoundStartsAtPlayerId = sharedWinnerState.players[0].id;
  sharedWinnerState.currentPlayerIndex = 2;
  sharedWinnerState.players[0].points = 15;
  sharedWinnerState.players[0].purchasedCards = BASE_LEVEL_1_CARDS.slice(0, 4);
  sharedWinnerState.players[1].points = 15;
  sharedWinnerState.players[1].purchasedCards = BASE_LEVEL_1_CARDS.slice(4, 8);
  sharedWinnerState.players[2].points = 12;

  applyGameAction(sharedWinnerState, sharedWinnerState.players[2].id, {
    type: 'take_three_distinct_tokens',
    colors: ['diamond']
  });

  assert.equal(sharedWinnerState.phase, 'finished');
  assert.deepEqual(
    sharedWinnerState.winnerIds,
    [sharedWinnerState.players[0].id, sharedWinnerState.players[1].id],
    'Players tied on score and purchased-card count should share the win.'
  );
}

function verifyMultipleNobleChoice() {
  const state = initializeGame(createRoom(2));
  const activePlayer = state.players[0];
  const firstNoble = BASE_NOBLES[0];
  const secondNoble = BASE_NOBLES[1];
  const cardToBuy = state.visibleCards.level1[0];

  state.nobles = [firstNoble, secondNoble];
  for (const color of ['diamond', 'sapphire', 'emerald', 'ruby', 'onyx'] as const) {
    activePlayer.bonuses[color] = Math.max(
      firstNoble.requirement[color],
      secondNoble.requirement[color]
    );
  }
  fundPlayerForCard(activePlayer, cardToBuy);

  applyGameAction(state, activePlayer.id, {
    type: 'purchase_card',
    level: 1,
    cardId: cardToBuy.id,
    source: 'board'
  });

  assert.deepEqual(state.pendingNobleClaim, {
    playerId: activePlayer.id,
    nobleIds: [firstNoble.id, secondNoble.id]
  });
  assert.equal(activePlayer.nobles.length, 0);
  assert.equal(state.currentPlayerIndex, 0);

  assert.throws(() =>
    applyGameAction(state, activePlayer.id, {
      type: 'take_three_distinct_tokens',
      colors: ['diamond']
    })
  );

  assert.deepEqual(state.pendingNobleClaim?.nobleIds, [firstNoble.id, secondNoble.id]);
  assert.equal(state.currentPlayerIndex, 0);

  applyGameAction(state, activePlayer.id, {
    type: 'claim_noble',
    nobleId: secondNoble.id
  });

  const updatedActivePlayer = state.players[0];
  assert.equal(state.pendingNobleClaim, null);
  assert.equal(updatedActivePlayer.nobles.length, 1);
  assert.equal(updatedActivePlayer.nobles[0].id, secondNoble.id);
  assert.equal(state.nobles.length, 1);
  assert.equal(state.nobles[0].id, firstNoble.id);
  assert.equal(state.currentPlayerIndex, 1);
}

function waitForSocketEvent<T>(socket: Socket, event: string, timeoutMs = 5000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timed out waiting for socket event "${event}".`));
    }, timeoutMs);

    socket.once(event, (payload: T) => {
      clearTimeout(timer);
      resolve(payload);
    });

    socket.once('connect_error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

async function createConnectedSocket(url: string): Promise<Socket> {
  const socket = createClient(url, {
    forceNew: true,
    reconnection: false,
    transports: ['websocket']
  });

  await waitForSocketEvent(socket, 'connect');
  return socket;
}

async function closeServer(server: ReturnType<typeof startServer>) {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

async function verifyLobbySessionResume() {
  const server = startServer({ port: 0, silent: true, snapshotPath: null });
  if (!server.listening) {
    await once(server, 'listening');
  }

  const address = server.address() as AddressInfo;
  const url = `http://127.0.0.1:${address.port}`;
  const clientId = 'verify-client-reconnect';
  const guestClientId = 'verify-guest-client';

  const firstSocket = await createConnectedSocket(url);
  const joinedPromise = waitForSocketEvent<{ room: Room; player: { id: string } }>(
    firstSocket,
    'room-joined'
  );
  firstSocket.emit('create-room', {
    roomName: 'Recovery Table',
    playerName: 'Host',
    clientId
  });

  const joined = await joinedPromise;
  const playerId = joined.player.id;
  const roomId = joined.room.id;

  const guestSocket = await createConnectedSocket(url);
  const guestJoinedPromise = waitForSocketEvent<{ room: Room; player: { id: string } }>(
    guestSocket,
    'room-joined'
  );
  guestSocket.emit('join-room', roomId, {
    name: 'Guest',
    clientId: guestClientId
  });
  await guestJoinedPromise;

  firstSocket.disconnect();

  const resumedSocket = await createConnectedSocket(url);
  const resumedPromise = waitForSocketEvent<{ room: Room; playerId: string }>(
    resumedSocket,
    'session-resumed'
  );
  const guestRoomUpdatedPromise = waitForSocketEvent<Room>(guestSocket, 'room-updated');
  resumedSocket.emit('resume-session', { roomId, clientId });
  const resumed = await resumedPromise;
  const guestUpdatedRoom = await guestRoomUpdatedPromise;

  assert.equal(resumed.playerId, playerId);
  assert.equal(resumed.room.id, roomId);
  assert.equal(resumed.room.players[0].id, playerId);
  assert.equal(resumed.room.players[0].connectionState, 'connected');
  assert.equal(resumed.room.status, 'open');
  assert.equal(
    guestUpdatedRoom.players.find((player) => player.id === playerId)?.connectionState,
    'connected'
  );

  resumedSocket.disconnect();
  guestSocket.disconnect();
  await closeServer(server);
}

async function verifyRoomLifecycleControls() {
  const server = startServer({ port: 0, silent: true, snapshotPath: null });
  if (!server.listening) {
    await once(server, 'listening');
  }

  const address = server.address() as AddressInfo;
  const url = `http://127.0.0.1:${address.port}`;
  const hostClientId = 'lifecycle-host-client';
  const guestClientId = 'lifecycle-guest-client';
  const secondGuestClientId = 'lifecycle-second-guest-client';

  const hostSocket = await createConnectedSocket(url);
  const hostJoinedPromise = waitForSocketEvent<{ room: Room; player: { id: string } }>(
    hostSocket,
    'room-joined'
  );
  hostSocket.emit('create-room', {
    roomName: 'Lifecycle Table',
    playerName: 'Host',
    clientId: hostClientId
  });
  const hostJoined = await hostJoinedPromise;
  const roomId = hostJoined.room.id;
  const hostPlayerId = hostJoined.player.id;

  const guestSocket = await createConnectedSocket(url);
  const hostSawGuestJoinPromise = waitForSocketEvent<Room>(hostSocket, 'room-updated');
  const guestJoinedPromise = waitForSocketEvent<{ room: Room; player: { id: string } }>(
    guestSocket,
    'room-joined'
  );
  guestSocket.emit('join-room', roomId, {
    name: 'Guest',
    clientId: guestClientId
  });
  await guestJoinedPromise;
  await hostSawGuestJoinPromise;

  const unauthorizedClosePromise = waitForSocketEvent<string>(guestSocket, 'game-error');
  guestSocket.emit('close-room', roomId);
  assert.equal(await unauthorizedClosePromise, 'Only the host can close the room.');

  const hostSawGuestLeavePromise = waitForSocketEvent<Room>(hostSocket, 'room-updated');
  const guestLeftPromise = waitForSocketEvent<{ roomId: string }>(guestSocket, 'room-left');
  guestSocket.emit('leave-room', roomId);
  const guestLeft = await guestLeftPromise;
  const roomAfterLeave = await hostSawGuestLeavePromise;

  assert.equal(guestLeft.roomId, roomId);
  assert.equal(roomAfterLeave.players.length, 1);
  assert.equal(roomAfterLeave.players[0].id, hostPlayerId);
  assert.equal(roomAfterLeave.players[0].isHost, true);

  const hostSawSecondJoinPromise = waitForSocketEvent<Room>(hostSocket, 'room-updated');
  const secondGuestJoinedPromise = waitForSocketEvent<{ room: Room; player: { id: string } }>(
    guestSocket,
    'room-joined'
  );
  guestSocket.emit('join-room', roomId, {
    name: 'Second Guest',
    clientId: secondGuestClientId
  });
  await secondGuestJoinedPromise;
  await hostSawSecondJoinPromise;

  const hostClosedPromise = waitForSocketEvent<{ roomId: string }>(hostSocket, 'room-closed');
  const guestClosedPromise = waitForSocketEvent<{ roomId: string }>(guestSocket, 'room-closed');
  hostSocket.emit('close-room', roomId);
  const hostClosed = await hostClosedPromise;
  const guestClosed = await guestClosedPromise;

  assert.equal(hostClosed.roomId, roomId);
  assert.equal(guestClosed.roomId, roomId);

  const resumeSocket = await createConnectedSocket(url);
  const failedResumePromise = waitForSocketEvent<string>(resumeSocket, 'session-resume-failed');
  resumeSocket.emit('resume-session', { roomId, clientId: hostClientId });
  await failedResumePromise;

  hostSocket.disconnect();
  guestSocket.disconnect();
  resumeSocket.disconnect();
  await closeServer(server);
}

async function verifyHostSnapshotRecovery() {
  const tempDir = mkdtempSync(path.join(tmpdir(), 'splendor-host-snapshot-'));
  const snapshotPath = path.join(tempDir, 'host-snapshot.json');

  try {
    const firstServer = startServer({ port: 0, silent: true, snapshotPath });
    if (!firstServer.listening) {
      await once(firstServer, 'listening');
    }

    const firstAddress = firstServer.address() as AddressInfo;
    const firstUrl = `http://127.0.0.1:${firstAddress.port}`;
    const hostClientId = 'snapshot-host-client';
    const guestClientId = 'snapshot-guest-client';

    const hostSocket = await createConnectedSocket(firstUrl);
    const hostJoinedPromise = waitForSocketEvent<{ room: Room; player: { id: string } }>(
      hostSocket,
      'room-joined'
    );
    hostSocket.emit('create-room', {
      roomName: 'Snapshot Table',
      playerName: 'Snapshot Host',
      clientId: hostClientId
    });
    const hostJoined = await hostJoinedPromise;
    const roomId = hostJoined.room.id;
    const hostPlayerId = hostJoined.player.id;

    const guestSocket = await createConnectedSocket(firstUrl);
    const guestJoinedPromise = waitForSocketEvent<{ room: Room; player: { id: string } }>(
      guestSocket,
      'room-joined'
    );
    guestSocket.emit('join-room', roomId, {
      name: 'Snapshot Guest',
      clientId: guestClientId
    });
    const guestJoined = await guestJoinedPromise;
    const guestPlayerId = guestJoined.player.id;

    const gameStartedPromise = waitForSocketEvent<GameState>(hostSocket, 'game-started');
    hostSocket.emit('start-game', roomId);
    const startedGame = await gameStartedPromise;
    assert.equal(startedGame.roomId, roomId);
    assert.equal(startedGame.players.length, 2);
    assert.equal(startedGame.visibleCards.level1.length, VISIBLE_CARDS_PER_LEVEL);

    hostSocket.disconnect();
    guestSocket.disconnect();
    await closeServer(firstServer);

    const restoredServer = startServer({ port: 0, silent: true, snapshotPath });
    if (!restoredServer.listening) {
      await once(restoredServer, 'listening');
    }

    const restoredAddress = restoredServer.address() as AddressInfo;
    const restoredUrl = `http://127.0.0.1:${restoredAddress.port}`;

    const resumedHostSocket = await createConnectedSocket(restoredUrl);
    const resumedHostPromise = waitForSocketEvent<{ room: Room; playerId: string }>(
      resumedHostSocket,
      'session-resumed'
    );
    resumedHostSocket.emit('resume-session', { roomId, clientId: hostClientId });
    const resumedHost = await resumedHostPromise;

    assert.equal(resumedHost.playerId, hostPlayerId);
    assert.equal(resumedHost.room.id, roomId);
    assert.equal(resumedHost.room.status, 'in_game');
    assert(resumedHost.room.gameState, 'Expected restored room to include game state.');
    assert.equal(
      resumedHost.room.gameState.players.find((player) => player.id === hostPlayerId)?.connectionState,
      'connected'
    );
    assert.equal(
      resumedHost.room.gameState.players.find((player) => player.id === guestPlayerId)?.connectionState,
      'disconnected'
    );

    const resumedGuestSocket = await createConnectedSocket(restoredUrl);
    const resumedGuestPromise = waitForSocketEvent<{ room: Room; playerId: string }>(
      resumedGuestSocket,
      'session-resumed'
    );
    resumedGuestSocket.emit('resume-session', { roomId, clientId: guestClientId });
    const resumedGuest = await resumedGuestPromise;

    assert.equal(resumedGuest.playerId, guestPlayerId);
    assert.equal(
      resumedGuest.room.gameState?.players.find((player) => player.id === guestPlayerId)?.connectionState,
      'connected'
    );

    resumedHostSocket.disconnect();
    resumedGuestSocket.disconnect();
    await closeServer(restoredServer);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

async function main() {
  verifyBaseSet();
  verifySetup(2);
  verifySetup(3);
  verifySetup(4);
  verifyTakeDifferentTokensAction();
  verifyTakeDifferentTokensValidation();
  verifyTakeTwoSameTokensValidation();
  verifyReserveCardAction();
  verifyOverflowRequiresReturn();
  verifyOverflowReturnAction();
  verifyHiddenInformationProjection();
  verifyPurchaseCardAction();
  verifyInvalidActionDoesNotMutateState();
  verifyNobleClaimAndFinalRound();
  verifyWinnerTieBreakerAndSharedWinners();
  verifyMultipleNobleChoice();
  await verifyLobbySessionResume();
  await verifyRoomLifecycleControls();
  await verifyHostSnapshotRecovery();

  console.log('Splendor base data verified.');
  console.log(
    'Validated 90 development cards, 10 nobles, setup rules, core turn actions, winner tie breakers, multiple-noble choice, invalid-action rollback, hidden information projection, lobby session recovery, room lifecycle controls, and host snapshot restore.'
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
