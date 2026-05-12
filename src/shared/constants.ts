import type { BonusColor, GemColor } from './types';

export const BONUS_COLORS: BonusColor[] = [
  'diamond',
  'sapphire',
  'emerald',
  'ruby',
  'onyx'
];

export const GEM_COLORS: GemColor[] = [...BONUS_COLORS, 'gold'];

export const MIN_PLAYERS_PER_ROOM = 2;
export const MAX_PLAYERS_PER_ROOM = 4;
export const RESERVED_CARD_LIMIT = 3;
export const TOKEN_LIMIT_PER_PLAYER = 10;
export const TARGET_PRESTIGE_POINTS = 15;
export const VISIBLE_CARDS_PER_LEVEL = 4;
export const GOLD_TOKEN_SUPPLY = 5;

export const TOKEN_SUPPLY_BY_PLAYER_COUNT = {
  2: 4,
  3: 5,
  4: 7
} as const;

export const DEVELOPMENT_CARD_COUNTS = {
  level1: 40,
  level2: 30,
  level3: 20
} as const;

export const NOBLE_TILE_COUNT = 10;

export const TURN_ACTIONS = [
  {
    key: 'take_three_distinct_tokens',
    title: 'Take up to 3 different gems',
    detail: 'You may take one token from up to three different gem colors.'
  },
  {
    key: 'take_two_same_tokens',
    title: 'Take 2 of one gem',
    detail: 'Only legal if at least 4 tokens of that color were available before taking.'
  },
  {
    key: 'reserve_card',
    title: 'Reserve a card',
    detail: 'Reserve 1 face-up card or the top card of a deck, and take 1 gold if any remain.'
  },
  {
    key: 'purchase_card',
    title: 'Buy a development',
    detail: 'Buy 1 visible or reserved card using tokens and permanent discounts from bonuses.'
  }
] as const;
