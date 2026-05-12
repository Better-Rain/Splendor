import {
  BONUS_COLORS,
  GOLD_TOKEN_SUPPLY,
  MAX_PLAYERS_PER_ROOM,
  MIN_PLAYERS_PER_ROOM,
  RESERVED_CARD_LIMIT,
  TARGET_PRESTIGE_POINTS,
  TOKEN_LIMIT_PER_PLAYER,
  TOKEN_SUPPLY_BY_PLAYER_COUNT,
  VISIBLE_CARDS_PER_LEVEL
} from '../shared/constants';
import { getBaseDevelopmentDecks, getBaseNoblePool } from '../shared/baseSet';
import {
  BonusColor,
  BonusMap,
  Card,
  CardLevel,
  GameAction,
  GamePlayer,
  GameState,
  Noble,
  ReservedCard,
  Room,
  TurnLogDetails,
  TokenSelection,
  TokenSupply
} from '../shared/types';

export class GameRuleError extends Error {}

function createEmptyBonusMap(): BonusMap {
  return {
    diamond: 0,
    sapphire: 0,
    emerald: 0,
    ruby: 0,
    onyx: 0
  };
}

function createEmptyTokenSupply(): TokenSupply {
  return {
    diamond: 0,
    sapphire: 0,
    emerald: 0,
    ruby: 0,
    onyx: 0,
    gold: 0
  };
}

function shuffle<T>(items: T[]): T[] {
  return [...items].sort(() => Math.random() - 0.5);
}

function now(): string {
  return new Date().toISOString();
}

function cloneBonusMap(map: BonusMap): BonusMap {
  return {
    diamond: map.diamond,
    sapphire: map.sapphire,
    emerald: map.emerald,
    ruby: map.ruby,
    onyx: map.onyx
  };
}

function cloneTokenSupply(tokens: TokenSupply): TokenSupply {
  return {
    diamond: tokens.diamond,
    sapphire: tokens.sapphire,
    emerald: tokens.emerald,
    ruby: tokens.ruby,
    onyx: tokens.onyx,
    gold: tokens.gold
  };
}

function cloneCard(card: Card): Card {
  return {
    ...card,
    cost: cloneBonusMap(card.cost)
  };
}

function cloneNoble(noble: Noble): Noble {
  return {
    ...noble,
    requirement: cloneBonusMap(noble.requirement)
  };
}

function cloneReservedCard(reservedCard: ReservedCard): ReservedCard {
  return {
    ...reservedCard,
    card: reservedCard.card ? cloneCard(reservedCard.card) : null
  };
}

function cloneGameState(state: GameState): GameState {
  return {
    ...state,
    players: state.players.map((player) => ({
      ...player,
      tokens: cloneTokenSupply(player.tokens),
      bonuses: cloneBonusMap(player.bonuses),
      purchasedCards: player.purchasedCards.map(cloneCard),
      reservedCards: player.reservedCards.map(cloneReservedCard),
      nobles: player.nobles.map(cloneNoble)
    })),
    gemSupply: cloneTokenSupply(state.gemSupply),
    pendingNobleClaim: state.pendingNobleClaim
      ? {
          playerId: state.pendingNobleClaim.playerId,
          nobleIds: [...state.pendingNobleClaim.nobleIds]
        }
      : null,
    decks: {
      level1: state.decks.level1.map(cloneCard),
      level2: state.decks.level2.map(cloneCard),
      level3: state.decks.level3.map(cloneCard)
    },
    visibleCards: {
      level1: state.visibleCards.level1.map(cloneCard),
      level2: state.visibleCards.level2.map(cloneCard),
      level3: state.visibleCards.level3.map(cloneCard)
    },
    nobles: state.nobles.map(cloneNoble),
    winnerIds: [...state.winnerIds],
    log: state.log.map((entry) => ({
      ...entry,
      details: entry.details
        ? {
            ...entry.details,
            colors: entry.details.colors ? [...entry.details.colors] : undefined
          }
        : undefined
    }))
  };
}

function restoreGameState(target: GameState, snapshot: GameState): void {
  Object.assign(target, snapshot);
}

function totalTokens(tokens: TokenSupply): number {
  return Object.values(tokens).reduce((sum, count) => sum + count, 0);
}

function levelKey(level: CardLevel): 'level1' | 'level2' | 'level3' {
  return `level${level}` as 'level1' | 'level2' | 'level3';
}

function getCurrentPlayer(state: GameState): GamePlayer {
  return state.players[state.currentPlayerIndex];
}

function normalizeReturnedTokens(selection?: TokenSelection): TokenSupply {
  const returnedTokens = createEmptyTokenSupply();

  if (!selection) {
    return returnedTokens;
  }

  for (const [key, value] of Object.entries(selection)) {
    if (value == null) {
      continue;
    }

    if (!Number.isInteger(value) || value < 0) {
      throw new GameRuleError('Returned token counts must be non-negative integers.');
    }

    returnedTokens[key as keyof TokenSupply] = value;
  }

  return returnedTokens;
}

function appendLog(
  state: GameState,
  playerId: string,
  type: GameAction['type'],
  summary: string,
  details?: TurnLogDetails
) {
  state.log.push({
    turn: state.turnNumber,
    playerId,
    type,
    summary,
    createdAt: now(),
    details
  });
}

function createGemSupply(playerCount: 2 | 3 | 4): TokenSupply {
  const gemCount = TOKEN_SUPPLY_BY_PLAYER_COUNT[playerCount];

  return {
    diamond: gemCount,
    sapphire: gemCount,
    emerald: gemCount,
    ruby: gemCount,
    onyx: gemCount,
    gold: GOLD_TOKEN_SUPPLY
  };
}

function toGamePlayer(roomPlayer: Room['players'][number]): GamePlayer {
  return {
    ...roomPlayer,
    tokens: createEmptyTokenSupply(),
    bonuses: createEmptyBonusMap(),
    purchasedCards: [],
    reservedCards: [],
    nobles: [],
    points: 0
  };
}

function createReservedCard(card: Card, source: 'board' | 'deck'): ReservedCard {
  return {
    id: card.id,
    level: card.level,
    visibility: source === 'board' ? 'public' : 'private',
    card
  };
}

function assertActivePlayer(state: GameState, playerId: string): GamePlayer {
  if (state.phase === 'finished') {
    throw new GameRuleError('The match has already finished.');
  }

  const player = getCurrentPlayer(state);
  if (player.id !== playerId) {
    throw new GameRuleError(`It is currently ${player.name}'s turn.`);
  }

  return player;
}

function enforceTokenLimit(player: GamePlayer, state: GameState, returnedTokens?: TokenSelection) {
  const overflow = totalTokens(player.tokens) - TOKEN_LIMIT_PER_PLAYER;
  const normalizedReturns = normalizeReturnedTokens(returnedTokens);
  const returnedCount = totalTokens(normalizedReturns);

  if (overflow <= 0) {
    if (returnedCount > 0) {
      throw new GameRuleError('No token return is needed for this action.');
    }
    return;
  }

  if (returnedCount !== overflow) {
    throw new GameRuleError(`You must return exactly ${overflow} token(s).`);
  }

  for (const color of Object.keys(normalizedReturns) as Array<keyof TokenSupply>) {
    const amount = normalizedReturns[color];
    if (amount > player.tokens[color]) {
      throw new GameRuleError(`You cannot return more ${color} tokens than you hold.`);
    }
  }

  for (const color of Object.keys(normalizedReturns) as Array<keyof TokenSupply>) {
    const amount = normalizedReturns[color];
    if (amount === 0) {
      continue;
    }

    player.tokens[color] -= amount;
    state.gemSupply[color] += amount;
  }
}

function drawVisibleReplacement(state: GameState, level: CardLevel, index: number) {
  const key = levelKey(level);
  const replacement = state.decks[key].shift();

  if (replacement) {
    state.visibleCards[key].splice(index, 0, replacement);
  }
}

function takeBoardCard(state: GameState, level: CardLevel, cardId?: string): Card {
  if (!cardId) {
    throw new GameRuleError('A visible card id is required.');
  }

  const key = levelKey(level);
  const index = state.visibleCards[key].findIndex((card) => card.id === cardId);
  if (index === -1) {
    throw new GameRuleError('The selected card is no longer available.');
  }

  const [card] = state.visibleCards[key].splice(index, 1);
  drawVisibleReplacement(state, level, index);
  return card;
}

function takeDeckTopCard(state: GameState, level: CardLevel): Card {
  const key = levelKey(level);
  const card = state.decks[key].shift();

  if (!card) {
    throw new GameRuleError('That deck is empty.');
  }

  return card;
}

function takeReservedCard(player: GamePlayer, cardId?: string): Card {
  if (!cardId) {
    throw new GameRuleError('A reserved card id is required.');
  }

  const index = player.reservedCards.findIndex((reservedCard) => reservedCard.id === cardId);
  if (index === -1) {
    throw new GameRuleError('That reserved card is not available.');
  }

  const [reservedCard] = player.reservedCards.splice(index, 1);
  if (!reservedCard.card) {
    throw new GameRuleError('That reserved card is hidden and cannot be resolved here.');
  }

  return reservedCard.card;
}

function getGoldNeededToBuyCard(player: GamePlayer, card: Card): number {
  return BONUS_COLORS.reduce((goldNeeded, color) => {
    const effectiveCost = Math.max(0, card.cost[color] - player.bonuses[color]);
    const shortfall = Math.max(0, effectiveCost - player.tokens[color]);
    return goldNeeded + shortfall;
  }, 0);
}

export function canPlayerAffordCard(player: GamePlayer, card: Card): boolean {
  return getGoldNeededToBuyCard(player, card) <= player.tokens.gold;
}

function payForCard(player: GamePlayer, state: GameState, card: Card) {
  if (!canPlayerAffordCard(player, card)) {
    throw new GameRuleError('You cannot afford that card.');
  }

  let goldToSpend = 0;

  for (const color of BONUS_COLORS) {
    const effectiveCost = Math.max(0, card.cost[color] - player.bonuses[color]);
    const coloredSpend = Math.min(player.tokens[color], effectiveCost);
    player.tokens[color] -= coloredSpend;
    state.gemSupply[color] += coloredSpend;

    const shortfall = effectiveCost - coloredSpend;
    goldToSpend += shortfall;
  }

  if (goldToSpend > 0) {
    player.tokens.gold -= goldToSpend;
    state.gemSupply.gold += goldToSpend;
  }
}

function getEligibleNobles(state: GameState, player: GamePlayer): Noble[] {
  return state.nobles.filter((noble) =>
    BONUS_COLORS.every((color) => player.bonuses[color] >= noble.requirement[color])
  );
}

function claimNoble(state: GameState, player: GamePlayer, nobleId: string): Noble {
  const nobleIndex = state.nobles.findIndex((noble) => noble.id === nobleId);
  if (nobleIndex === -1) {
    throw new GameRuleError('That noble is not available.');
  }

  const [noble] = state.nobles.splice(nobleIndex, 1);
  player.nobles.push(noble);
  player.points += noble.points;
  appendLog(state, player.id, 'claim_noble', `${player.name} claimed noble ${noble.id}.`, {
    nobleId: noble.id
  });
  return noble;
}

function resolveEligibleNobles(state: GameState, player: GamePlayer): boolean {
  const eligibleNobles = getEligibleNobles(state, player);

  if (eligibleNobles.length === 0) {
    return false;
  }

  if (eligibleNobles.length === 1) {
    claimNoble(state, player, eligibleNobles[0].id);
    return false;
  }

  state.pendingNobleClaim = {
    playerId: player.id,
    nobleIds: eligibleNobles.map((noble) => noble.id)
  };
  return true;
}

function finalizeIfNeeded(state: GameState, player: GamePlayer) {
  if (state.phase === 'playing' && player.points >= state.targetScore) {
    state.phase = 'last_round';
    state.finalRoundStartsAtPlayerId = player.id;
  }

  const nextPlayerIndex = (state.currentPlayerIndex + 1) % state.players.length;

  if (
    state.phase === 'last_round' &&
    state.finalRoundStartsAtPlayerId &&
    state.players[nextPlayerIndex].id === state.finalRoundStartsAtPlayerId
  ) {
    const highestScore = Math.max(...state.players.map((candidate) => candidate.points));
    const leaders = state.players.filter((candidate) => candidate.points === highestScore);
    const fewestPurchasedCards = Math.min(
      ...leaders.map((candidate) => candidate.purchasedCards.length)
    );

    state.winnerIds = leaders
      .filter((candidate) => candidate.purchasedCards.length === fewestPurchasedCards)
      .map((candidate) => candidate.id);
    state.phase = 'finished';
    return;
  }

  if (nextPlayerIndex === 0) {
    state.turnNumber += 1;
  }

  state.currentPlayerIndex = nextPlayerIndex;
}

function applyTakeThreeDistinctTokens(
  state: GameState,
  player: GamePlayer,
  action: Extract<GameAction, { type: 'take_three_distinct_tokens' }>
) {
  const uniqueColors = Array.from(new Set(action.colors));
  if (uniqueColors.length !== action.colors.length) {
    throw new GameRuleError('You must choose different gem colors.');
  }

  if (uniqueColors.length < 1 || uniqueColors.length > 3) {
    throw new GameRuleError('Choose between 1 and 3 different gem colors.');
  }

  for (const color of uniqueColors) {
    if (state.gemSupply[color] < 1) {
      throw new GameRuleError(`No ${color} tokens are available in the bank.`);
    }
  }

  for (const color of uniqueColors) {
    state.gemSupply[color] -= 1;
    player.tokens[color] += 1;
  }

  enforceTokenLimit(player, state, action.returnedTokens);
  appendLog(
    state,
    player.id,
    action.type,
    `${player.name} took ${uniqueColors.join(', ')} token(s).`,
    { colors: uniqueColors }
  );
}

function applyTakeTwoSameTokens(
  state: GameState,
  player: GamePlayer,
  action: Extract<GameAction, { type: 'take_two_same_tokens' }>
) {
  if (state.gemSupply[action.color] < 4) {
    throw new GameRuleError(
      `You can only take two ${action.color} tokens if at least 4 were available.`
    );
  }

  state.gemSupply[action.color] -= 2;
  player.tokens[action.color] += 2;

  enforceTokenLimit(player, state, action.returnedTokens);
  appendLog(state, player.id, action.type, `${player.name} took 2 ${action.color} tokens.`, {
    color: action.color
  });
}

function applyReserveCard(
  state: GameState,
  player: GamePlayer,
  action: Extract<GameAction, { type: 'reserve_card' }>
) {
  if (player.reservedCards.length >= RESERVED_CARD_LIMIT) {
    throw new GameRuleError(`You may only reserve up to ${RESERVED_CARD_LIMIT} cards.`);
  }

  const card =
    action.source === 'board'
      ? takeBoardCard(state, action.level, action.cardId)
      : takeDeckTopCard(state, action.level);

  player.reservedCards.push(createReservedCard(card, action.source));

  if (state.gemSupply.gold > 0) {
    state.gemSupply.gold -= 1;
    player.tokens.gold += 1;
  }

  enforceTokenLimit(player, state, action.returnedTokens);
  appendLog(
    state,
    player.id,
    action.type,
    `${player.name} reserved ${card.id}${action.source === 'deck' ? ' from the deck' : ''}.`,
    { cardId: card.id, source: action.source }
  );
}

function applyPurchaseCard(
  state: GameState,
  player: GamePlayer,
  action: Extract<GameAction, { type: 'purchase_card' }>
): boolean {
  const card =
    action.source === 'board'
      ? takeBoardCard(state, action.level, action.cardId)
      : takeReservedCard(player, action.cardId);

  payForCard(player, state, card);
  player.purchasedCards.push(card);
  player.bonuses[card.bonus] += 1;
  player.points += card.points;

  appendLog(state, player.id, action.type, `${player.name} purchased ${card.id}.`, {
    cardId: card.id,
    source: action.source
  });
  return resolveEligibleNobles(state, player);
}

function applyClaimNoble(
  state: GameState,
  player: GamePlayer,
  action: Extract<GameAction, { type: 'claim_noble' }>
) {
  const pendingClaim = state.pendingNobleClaim;

  if (!pendingClaim || pendingClaim.playerId !== player.id) {
    throw new GameRuleError('No noble choice is pending for this player.');
  }

  if (!pendingClaim.nobleIds.includes(action.nobleId)) {
    throw new GameRuleError('Choose one of the available nobles.');
  }

  claimNoble(state, player, action.nobleId);
  state.pendingNobleClaim = null;
}

export function generateCards(): { level1: Card[]; level2: Card[]; level3: Card[] } {
  const decks = getBaseDevelopmentDecks();

  return {
    level1: shuffle(decks.level1),
    level2: shuffle(decks.level2),
    level3: shuffle(decks.level3)
  };
}

export function generateNobles(playerCount: number): Noble[] {
  const nobleCount = playerCount + 1;
  return shuffle(getBaseNoblePool()).slice(0, nobleCount);
}

export function canStartGame(room: Room): boolean {
  return room.players.length >= MIN_PLAYERS_PER_ROOM && room.players.length <= MAX_PLAYERS_PER_ROOM;
}

export function initializeGame(room: Room): GameState {
  if (!canStartGame(room)) {
    throw new Error('Splendor requires between 2 and 4 players.');
  }

  const playerCount = room.players.length as 2 | 3 | 4;
  const { level1, level2, level3 } = generateCards();

  return {
    roomId: room.id,
    players: room.players.map(toGamePlayer),
    currentPlayerIndex: 0,
    phase: 'playing',
    turnNumber: 1,
    targetScore: TARGET_PRESTIGE_POINTS,
    finalRoundStartsAtPlayerId: null,
    pendingNobleClaim: null,
    gemSupply: createGemSupply(playerCount),
    decks: {
      level1: level1.slice(VISIBLE_CARDS_PER_LEVEL),
      level2: level2.slice(VISIBLE_CARDS_PER_LEVEL),
      level3: level3.slice(VISIBLE_CARDS_PER_LEVEL)
    },
    visibleCards: {
      level1: level1.slice(0, VISIBLE_CARDS_PER_LEVEL),
      level2: level2.slice(0, VISIBLE_CARDS_PER_LEVEL),
      level3: level3.slice(0, VISIBLE_CARDS_PER_LEVEL)
    },
    nobles: generateNobles(playerCount),
    winnerIds: [],
    log: []
  };
}

export function applyGameAction(state: GameState, playerId: string, action: GameAction): GameState {
  const snapshot = cloneGameState(state);

  try {
    const player = assertActivePlayer(state, playerId);
    let shouldFinalize = true;

    switch (action.type) {
      case 'take_three_distinct_tokens':
        if (state.pendingNobleClaim) {
          throw new GameRuleError('Choose a noble before taking another action.');
        }
        applyTakeThreeDistinctTokens(state, player, action);
        break;
      case 'take_two_same_tokens':
        if (state.pendingNobleClaim) {
          throw new GameRuleError('Choose a noble before taking another action.');
        }
        applyTakeTwoSameTokens(state, player, action);
        break;
      case 'reserve_card':
        if (state.pendingNobleClaim) {
          throw new GameRuleError('Choose a noble before taking another action.');
        }
        applyReserveCard(state, player, action);
        break;
      case 'purchase_card':
        if (state.pendingNobleClaim) {
          throw new GameRuleError('Choose a noble before taking another action.');
        }
        shouldFinalize = !applyPurchaseCard(state, player, action);
        break;
      case 'claim_noble':
        applyClaimNoble(state, player, action);
        break;
      default:
        throw new GameRuleError('Unknown game action.');
    }

    if (shouldFinalize) {
      finalizeIfNeeded(state, player);
    }
    return state;
  } catch (error) {
    restoreGameState(state, snapshot);
    throw error;
  }
}
