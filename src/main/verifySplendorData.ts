import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
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
import { Room } from '../shared/types';
import { applyGameAction, initializeGame } from './gameLogic';

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

verifyBaseSet();
verifySetup(2);
verifySetup(3);
verifySetup(4);
verifyTakeDifferentTokensAction();
verifyTakeTwoSameTokensValidation();
verifyReserveCardAction();
verifyOverflowRequiresReturn();
verifyOverflowReturnAction();
verifyPurchaseCardAction();
verifyNobleClaimAndFinalRound();

console.log('Splendor base data verified.');
console.log('Validated 90 development cards, 10 nobles, setup rules, and core turn actions.');
