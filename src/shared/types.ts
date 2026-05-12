export type BonusColor = 'diamond' | 'sapphire' | 'emerald' | 'ruby' | 'onyx';
export type GemColor = BonusColor | 'gold';
export type CardLevel = 1 | 2 | 3;
export type GamePhase = 'lobby' | 'playing' | 'last_round' | 'finished';
export type RoomStatus = 'open' | 'in_game' | 'closed';
export type PlayerConnectionState = 'connected' | 'disconnected';

export type BonusMap = Record<BonusColor, number>;
export type TokenSupply = Record<GemColor, number>;
export type TokenSelection = Partial<Record<GemColor, number>>;

export interface Card {
  id: string;
  level: CardLevel;
  points: number;
  bonus: BonusColor;
  cost: BonusMap;
}

export interface Noble {
  id: string;
  points: number;
  requirement: BonusMap;
}

export interface ReservedCard {
  id: string;
  level: CardLevel;
  visibility: 'public' | 'private';
  card: Card | null;
}

export interface LobbyPlayer {
  id: string;
  name: string;
  isHost: boolean;
  seat: number;
  joinedAt: string;
  connectionState: PlayerConnectionState;
}

export interface GamePlayer extends LobbyPlayer {
  tokens: TokenSupply;
  bonuses: BonusMap;
  purchasedCards: Card[];
  reservedCards: ReservedCard[];
  nobles: Noble[];
  points: number;
}

export interface TurnLogDetails {
  colors?: BonusColor[];
  color?: BonusColor;
  cardId?: string;
  nobleId?: string;
  source?: 'board' | 'deck' | 'reserved';
}

export interface TurnLogEntry {
  turn: number;
  playerId: string;
  type: GameAction['type'];
  summary: string;
  createdAt: string;
  details?: TurnLogDetails;
}

export interface PendingNobleClaim {
  playerId: string;
  nobleIds: string[];
}

export interface GameState {
  roomId: string;
  players: GamePlayer[];
  currentPlayerIndex: number;
  phase: GamePhase;
  turnNumber: number;
  targetScore: number;
  finalRoundStartsAtPlayerId: string | null;
  pendingNobleClaim: PendingNobleClaim | null;
  gemSupply: TokenSupply;
  decks: {
    level1: Card[];
    level2: Card[];
    level3: Card[];
  };
  visibleCards: {
    level1: Card[];
    level2: Card[];
    level3: Card[];
  };
  nobles: Noble[];
  winnerIds: string[];
  log: TurnLogEntry[];
}

export interface Room {
  id: string;
  name: string;
  hostId: string;
  status: RoomStatus;
  players: LobbyPlayer[];
  gameState: GameState | null;
  createdAt: string;
  updatedAt: string;
}

export type GameAction =
  | {
      type: 'take_three_distinct_tokens';
      colors: BonusColor[];
      returnedTokens?: TokenSelection;
    }
  | {
      type: 'take_two_same_tokens';
      color: BonusColor;
      returnedTokens?: TokenSelection;
    }
  | {
      type: 'reserve_card';
      level: CardLevel;
      cardId?: string;
      source: 'board' | 'deck';
      returnedTokens?: TokenSelection;
    }
  | {
      type: 'purchase_card';
      level: CardLevel;
      cardId?: string;
      source: 'board' | 'reserved';
    }
  | {
      type: 'claim_noble';
      nobleId: string;
    };
