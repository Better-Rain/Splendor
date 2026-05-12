import type { Card, Noble } from './types';

// Base-game card and noble data used by the LAN rules engine.
export const BASE_LEVEL_1_CARDS: ReadonlyArray<Card> = [
  {
    "id": "level-1-1",
    "level": 1,
    "points": 0,
    "bonus": "onyx",
    "cost": {
      "diamond": 1,
      "sapphire": 1,
      "emerald": 1,
      "ruby": 1,
      "onyx": 0
    }
  },
  {
    "id": "level-1-2",
    "level": 1,
    "points": 0,
    "bonus": "onyx",
    "cost": {
      "diamond": 1,
      "sapphire": 2,
      "emerald": 1,
      "ruby": 1,
      "onyx": 0
    }
  },
  {
    "id": "level-1-3",
    "level": 1,
    "points": 0,
    "bonus": "onyx",
    "cost": {
      "diamond": 2,
      "sapphire": 2,
      "emerald": 0,
      "ruby": 1,
      "onyx": 0
    }
  },
  {
    "id": "level-1-4",
    "level": 1,
    "points": 0,
    "bonus": "onyx",
    "cost": {
      "diamond": 0,
      "sapphire": 0,
      "emerald": 1,
      "ruby": 3,
      "onyx": 1
    }
  },
  {
    "id": "level-1-5",
    "level": 1,
    "points": 0,
    "bonus": "onyx",
    "cost": {
      "diamond": 0,
      "sapphire": 0,
      "emerald": 2,
      "ruby": 1,
      "onyx": 0
    }
  },
  {
    "id": "level-1-6",
    "level": 1,
    "points": 0,
    "bonus": "onyx",
    "cost": {
      "diamond": 2,
      "sapphire": 0,
      "emerald": 2,
      "ruby": 0,
      "onyx": 0
    }
  },
  {
    "id": "level-1-7",
    "level": 1,
    "points": 0,
    "bonus": "onyx",
    "cost": {
      "diamond": 0,
      "sapphire": 0,
      "emerald": 3,
      "ruby": 0,
      "onyx": 0
    }
  },
  {
    "id": "level-1-8",
    "level": 1,
    "points": 1,
    "bonus": "onyx",
    "cost": {
      "diamond": 0,
      "sapphire": 4,
      "emerald": 0,
      "ruby": 0,
      "onyx": 0
    }
  },
  {
    "id": "level-1-9",
    "level": 1,
    "points": 0,
    "bonus": "sapphire",
    "cost": {
      "diamond": 1,
      "sapphire": 0,
      "emerald": 1,
      "ruby": 1,
      "onyx": 1
    }
  },
  {
    "id": "level-1-10",
    "level": 1,
    "points": 0,
    "bonus": "sapphire",
    "cost": {
      "diamond": 1,
      "sapphire": 0,
      "emerald": 1,
      "ruby": 2,
      "onyx": 1
    }
  },
  {
    "id": "level-1-11",
    "level": 1,
    "points": 0,
    "bonus": "sapphire",
    "cost": {
      "diamond": 1,
      "sapphire": 0,
      "emerald": 2,
      "ruby": 2,
      "onyx": 0
    }
  },
  {
    "id": "level-1-12",
    "level": 1,
    "points": 0,
    "bonus": "sapphire",
    "cost": {
      "diamond": 0,
      "sapphire": 1,
      "emerald": 3,
      "ruby": 1,
      "onyx": 0
    }
  },
  {
    "id": "level-1-13",
    "level": 1,
    "points": 0,
    "bonus": "sapphire",
    "cost": {
      "diamond": 1,
      "sapphire": 0,
      "emerald": 0,
      "ruby": 0,
      "onyx": 2
    }
  },
  {
    "id": "level-1-14",
    "level": 1,
    "points": 0,
    "bonus": "sapphire",
    "cost": {
      "diamond": 0,
      "sapphire": 0,
      "emerald": 2,
      "ruby": 0,
      "onyx": 2
    }
  },
  {
    "id": "level-1-15",
    "level": 1,
    "points": 0,
    "bonus": "sapphire",
    "cost": {
      "diamond": 0,
      "sapphire": 0,
      "emerald": 0,
      "ruby": 0,
      "onyx": 3
    }
  },
  {
    "id": "level-1-16",
    "level": 1,
    "points": 1,
    "bonus": "sapphire",
    "cost": {
      "diamond": 0,
      "sapphire": 0,
      "emerald": 0,
      "ruby": 4,
      "onyx": 0
    }
  },
  {
    "id": "level-1-17",
    "level": 1,
    "points": 0,
    "bonus": "diamond",
    "cost": {
      "diamond": 0,
      "sapphire": 1,
      "emerald": 1,
      "ruby": 1,
      "onyx": 1
    }
  },
  {
    "id": "level-1-18",
    "level": 1,
    "points": 0,
    "bonus": "diamond",
    "cost": {
      "diamond": 0,
      "sapphire": 1,
      "emerald": 2,
      "ruby": 1,
      "onyx": 1
    }
  },
  {
    "id": "level-1-19",
    "level": 1,
    "points": 0,
    "bonus": "diamond",
    "cost": {
      "diamond": 0,
      "sapphire": 2,
      "emerald": 2,
      "ruby": 0,
      "onyx": 1
    }
  },
  {
    "id": "level-1-20",
    "level": 1,
    "points": 0,
    "bonus": "diamond",
    "cost": {
      "diamond": 3,
      "sapphire": 1,
      "emerald": 0,
      "ruby": 0,
      "onyx": 1
    }
  },
  {
    "id": "level-1-21",
    "level": 1,
    "points": 0,
    "bonus": "diamond",
    "cost": {
      "diamond": 0,
      "sapphire": 0,
      "emerald": 0,
      "ruby": 2,
      "onyx": 1
    }
  },
  {
    "id": "level-1-22",
    "level": 1,
    "points": 0,
    "bonus": "diamond",
    "cost": {
      "diamond": 0,
      "sapphire": 2,
      "emerald": 0,
      "ruby": 0,
      "onyx": 2
    }
  },
  {
    "id": "level-1-23",
    "level": 1,
    "points": 0,
    "bonus": "diamond",
    "cost": {
      "diamond": 0,
      "sapphire": 3,
      "emerald": 0,
      "ruby": 0,
      "onyx": 0
    }
  },
  {
    "id": "level-1-24",
    "level": 1,
    "points": 1,
    "bonus": "diamond",
    "cost": {
      "diamond": 0,
      "sapphire": 0,
      "emerald": 4,
      "ruby": 0,
      "onyx": 0
    }
  },
  {
    "id": "level-1-25",
    "level": 1,
    "points": 0,
    "bonus": "emerald",
    "cost": {
      "diamond": 1,
      "sapphire": 1,
      "emerald": 0,
      "ruby": 1,
      "onyx": 1
    }
  },
  {
    "id": "level-1-26",
    "level": 1,
    "points": 0,
    "bonus": "emerald",
    "cost": {
      "diamond": 1,
      "sapphire": 1,
      "emerald": 0,
      "ruby": 1,
      "onyx": 2
    }
  },
  {
    "id": "level-1-27",
    "level": 1,
    "points": 0,
    "bonus": "emerald",
    "cost": {
      "diamond": 0,
      "sapphire": 1,
      "emerald": 0,
      "ruby": 2,
      "onyx": 2
    }
  },
  {
    "id": "level-1-28",
    "level": 1,
    "points": 0,
    "bonus": "emerald",
    "cost": {
      "diamond": 1,
      "sapphire": 3,
      "emerald": 1,
      "ruby": 0,
      "onyx": 0
    }
  },
  {
    "id": "level-1-29",
    "level": 1,
    "points": 0,
    "bonus": "emerald",
    "cost": {
      "diamond": 2,
      "sapphire": 1,
      "emerald": 0,
      "ruby": 0,
      "onyx": 0
    }
  },
  {
    "id": "level-1-30",
    "level": 1,
    "points": 0,
    "bonus": "emerald",
    "cost": {
      "diamond": 0,
      "sapphire": 2,
      "emerald": 0,
      "ruby": 2,
      "onyx": 0
    }
  },
  {
    "id": "level-1-31",
    "level": 1,
    "points": 0,
    "bonus": "emerald",
    "cost": {
      "diamond": 0,
      "sapphire": 0,
      "emerald": 0,
      "ruby": 3,
      "onyx": 0
    }
  },
  {
    "id": "level-1-32",
    "level": 1,
    "points": 1,
    "bonus": "emerald",
    "cost": {
      "diamond": 0,
      "sapphire": 0,
      "emerald": 0,
      "ruby": 0,
      "onyx": 4
    }
  },
  {
    "id": "level-1-33",
    "level": 1,
    "points": 0,
    "bonus": "ruby",
    "cost": {
      "diamond": 1,
      "sapphire": 1,
      "emerald": 1,
      "ruby": 0,
      "onyx": 1
    }
  },
  {
    "id": "level-1-34",
    "level": 1,
    "points": 0,
    "bonus": "ruby",
    "cost": {
      "diamond": 2,
      "sapphire": 1,
      "emerald": 1,
      "ruby": 0,
      "onyx": 1
    }
  },
  {
    "id": "level-1-35",
    "level": 1,
    "points": 0,
    "bonus": "ruby",
    "cost": {
      "diamond": 2,
      "sapphire": 0,
      "emerald": 1,
      "ruby": 0,
      "onyx": 2
    }
  },
  {
    "id": "level-1-36",
    "level": 1,
    "points": 0,
    "bonus": "ruby",
    "cost": {
      "diamond": 1,
      "sapphire": 0,
      "emerald": 0,
      "ruby": 1,
      "onyx": 3
    }
  },
  {
    "id": "level-1-37",
    "level": 1,
    "points": 0,
    "bonus": "ruby",
    "cost": {
      "diamond": 0,
      "sapphire": 2,
      "emerald": 1,
      "ruby": 0,
      "onyx": 0
    }
  },
  {
    "id": "level-1-38",
    "level": 1,
    "points": 0,
    "bonus": "ruby",
    "cost": {
      "diamond": 2,
      "sapphire": 0,
      "emerald": 0,
      "ruby": 2,
      "onyx": 0
    }
  },
  {
    "id": "level-1-39",
    "level": 1,
    "points": 0,
    "bonus": "ruby",
    "cost": {
      "diamond": 3,
      "sapphire": 0,
      "emerald": 0,
      "ruby": 0,
      "onyx": 0
    }
  },
  {
    "id": "level-1-40",
    "level": 1,
    "points": 1,
    "bonus": "ruby",
    "cost": {
      "diamond": 4,
      "sapphire": 0,
      "emerald": 0,
      "ruby": 0,
      "onyx": 0
    }
  }
];

export const BASE_LEVEL_2_CARDS: ReadonlyArray<Card> = [
  {
    "id": "level-2-1",
    "level": 2,
    "points": 1,
    "bonus": "onyx",
    "cost": {
      "diamond": 3,
      "sapphire": 2,
      "emerald": 2,
      "ruby": 0,
      "onyx": 0
    }
  },
  {
    "id": "level-2-2",
    "level": 2,
    "points": 1,
    "bonus": "onyx",
    "cost": {
      "diamond": 3,
      "sapphire": 0,
      "emerald": 3,
      "ruby": 0,
      "onyx": 2
    }
  },
  {
    "id": "level-2-3",
    "level": 2,
    "points": 2,
    "bonus": "onyx",
    "cost": {
      "diamond": 0,
      "sapphire": 1,
      "emerald": 4,
      "ruby": 2,
      "onyx": 0
    }
  },
  {
    "id": "level-2-4",
    "level": 2,
    "points": 2,
    "bonus": "onyx",
    "cost": {
      "diamond": 0,
      "sapphire": 0,
      "emerald": 5,
      "ruby": 3,
      "onyx": 0
    }
  },
  {
    "id": "level-2-5",
    "level": 2,
    "points": 2,
    "bonus": "onyx",
    "cost": {
      "diamond": 5,
      "sapphire": 0,
      "emerald": 0,
      "ruby": 0,
      "onyx": 0
    }
  },
  {
    "id": "level-2-6",
    "level": 2,
    "points": 3,
    "bonus": "onyx",
    "cost": {
      "diamond": 0,
      "sapphire": 0,
      "emerald": 0,
      "ruby": 0,
      "onyx": 6
    }
  },
  {
    "id": "level-2-7",
    "level": 2,
    "points": 1,
    "bonus": "sapphire",
    "cost": {
      "diamond": 0,
      "sapphire": 2,
      "emerald": 2,
      "ruby": 3,
      "onyx": 0
    }
  },
  {
    "id": "level-2-8",
    "level": 2,
    "points": 1,
    "bonus": "sapphire",
    "cost": {
      "diamond": 0,
      "sapphire": 2,
      "emerald": 3,
      "ruby": 0,
      "onyx": 3
    }
  },
  {
    "id": "level-2-9",
    "level": 2,
    "points": 2,
    "bonus": "sapphire",
    "cost": {
      "diamond": 5,
      "sapphire": 3,
      "emerald": 0,
      "ruby": 0,
      "onyx": 0
    }
  },
  {
    "id": "level-2-10",
    "level": 2,
    "points": 2,
    "bonus": "sapphire",
    "cost": {
      "diamond": 2,
      "sapphire": 0,
      "emerald": 0,
      "ruby": 1,
      "onyx": 4
    }
  },
  {
    "id": "level-2-11",
    "level": 2,
    "points": 2,
    "bonus": "sapphire",
    "cost": {
      "diamond": 0,
      "sapphire": 5,
      "emerald": 0,
      "ruby": 0,
      "onyx": 0
    }
  },
  {
    "id": "level-2-12",
    "level": 2,
    "points": 3,
    "bonus": "sapphire",
    "cost": {
      "diamond": 0,
      "sapphire": 6,
      "emerald": 0,
      "ruby": 0,
      "onyx": 0
    }
  },
  {
    "id": "level-2-13",
    "level": 2,
    "points": 1,
    "bonus": "diamond",
    "cost": {
      "diamond": 0,
      "sapphire": 0,
      "emerald": 3,
      "ruby": 2,
      "onyx": 2
    }
  },
  {
    "id": "level-2-14",
    "level": 2,
    "points": 1,
    "bonus": "diamond",
    "cost": {
      "diamond": 2,
      "sapphire": 3,
      "emerald": 0,
      "ruby": 3,
      "onyx": 0
    }
  },
  {
    "id": "level-2-15",
    "level": 2,
    "points": 2,
    "bonus": "diamond",
    "cost": {
      "diamond": 0,
      "sapphire": 0,
      "emerald": 1,
      "ruby": 4,
      "onyx": 2
    }
  },
  {
    "id": "level-2-16",
    "level": 2,
    "points": 2,
    "bonus": "diamond",
    "cost": {
      "diamond": 0,
      "sapphire": 0,
      "emerald": 0,
      "ruby": 5,
      "onyx": 3
    }
  },
  {
    "id": "level-2-17",
    "level": 2,
    "points": 2,
    "bonus": "diamond",
    "cost": {
      "diamond": 0,
      "sapphire": 0,
      "emerald": 0,
      "ruby": 5,
      "onyx": 0
    }
  },
  {
    "id": "level-2-18",
    "level": 2,
    "points": 3,
    "bonus": "diamond",
    "cost": {
      "diamond": 6,
      "sapphire": 0,
      "emerald": 0,
      "ruby": 0,
      "onyx": 0
    }
  },
  {
    "id": "level-2-19",
    "level": 2,
    "points": 1,
    "bonus": "emerald",
    "cost": {
      "diamond": 3,
      "sapphire": 0,
      "emerald": 2,
      "ruby": 3,
      "onyx": 0
    }
  },
  {
    "id": "level-2-20",
    "level": 2,
    "points": 1,
    "bonus": "emerald",
    "cost": {
      "diamond": 2,
      "sapphire": 3,
      "emerald": 0,
      "ruby": 0,
      "onyx": 2
    }
  },
  {
    "id": "level-2-21",
    "level": 2,
    "points": 2,
    "bonus": "emerald",
    "cost": {
      "diamond": 4,
      "sapphire": 2,
      "emerald": 0,
      "ruby": 0,
      "onyx": 1
    }
  },
  {
    "id": "level-2-22",
    "level": 2,
    "points": 2,
    "bonus": "emerald",
    "cost": {
      "diamond": 0,
      "sapphire": 5,
      "emerald": 3,
      "ruby": 0,
      "onyx": 0
    }
  },
  {
    "id": "level-2-23",
    "level": 2,
    "points": 2,
    "bonus": "emerald",
    "cost": {
      "diamond": 0,
      "sapphire": 0,
      "emerald": 5,
      "ruby": 0,
      "onyx": 0
    }
  },
  {
    "id": "level-2-24",
    "level": 2,
    "points": 3,
    "bonus": "emerald",
    "cost": {
      "diamond": 0,
      "sapphire": 0,
      "emerald": 6,
      "ruby": 0,
      "onyx": 0
    }
  },
  {
    "id": "level-2-25",
    "level": 2,
    "points": 1,
    "bonus": "ruby",
    "cost": {
      "diamond": 2,
      "sapphire": 0,
      "emerald": 0,
      "ruby": 2,
      "onyx": 3
    }
  },
  {
    "id": "level-2-26",
    "level": 2,
    "points": 1,
    "bonus": "ruby",
    "cost": {
      "diamond": 0,
      "sapphire": 3,
      "emerald": 0,
      "ruby": 2,
      "onyx": 3
    }
  },
  {
    "id": "level-2-27",
    "level": 2,
    "points": 2,
    "bonus": "ruby",
    "cost": {
      "diamond": 1,
      "sapphire": 4,
      "emerald": 2,
      "ruby": 0,
      "onyx": 0
    }
  },
  {
    "id": "level-2-28",
    "level": 2,
    "points": 2,
    "bonus": "ruby",
    "cost": {
      "diamond": 3,
      "sapphire": 0,
      "emerald": 0,
      "ruby": 0,
      "onyx": 5
    }
  },
  {
    "id": "level-2-29",
    "level": 2,
    "points": 2,
    "bonus": "ruby",
    "cost": {
      "diamond": 0,
      "sapphire": 0,
      "emerald": 0,
      "ruby": 0,
      "onyx": 5
    }
  },
  {
    "id": "level-2-30",
    "level": 2,
    "points": 3,
    "bonus": "ruby",
    "cost": {
      "diamond": 0,
      "sapphire": 0,
      "emerald": 0,
      "ruby": 6,
      "onyx": 0
    }
  }
];

export const BASE_LEVEL_3_CARDS: ReadonlyArray<Card> = [
  {
    "id": "level-3-1",
    "level": 3,
    "points": 3,
    "bonus": "onyx",
    "cost": {
      "diamond": 3,
      "sapphire": 3,
      "emerald": 5,
      "ruby": 3,
      "onyx": 0
    }
  },
  {
    "id": "level-3-2",
    "level": 3,
    "points": 4,
    "bonus": "onyx",
    "cost": {
      "diamond": 0,
      "sapphire": 0,
      "emerald": 0,
      "ruby": 7,
      "onyx": 0
    }
  },
  {
    "id": "level-3-3",
    "level": 3,
    "points": 4,
    "bonus": "onyx",
    "cost": {
      "diamond": 0,
      "sapphire": 0,
      "emerald": 3,
      "ruby": 6,
      "onyx": 3
    }
  },
  {
    "id": "level-3-4",
    "level": 3,
    "points": 5,
    "bonus": "onyx",
    "cost": {
      "diamond": 0,
      "sapphire": 0,
      "emerald": 0,
      "ruby": 7,
      "onyx": 3
    }
  },
  {
    "id": "level-3-5",
    "level": 3,
    "points": 3,
    "bonus": "sapphire",
    "cost": {
      "diamond": 3,
      "sapphire": 0,
      "emerald": 3,
      "ruby": 3,
      "onyx": 5
    }
  },
  {
    "id": "level-3-6",
    "level": 3,
    "points": 4,
    "bonus": "sapphire",
    "cost": {
      "diamond": 7,
      "sapphire": 0,
      "emerald": 0,
      "ruby": 0,
      "onyx": 0
    }
  },
  {
    "id": "level-3-7",
    "level": 3,
    "points": 4,
    "bonus": "sapphire",
    "cost": {
      "diamond": 6,
      "sapphire": 3,
      "emerald": 0,
      "ruby": 0,
      "onyx": 3
    }
  },
  {
    "id": "level-3-8",
    "level": 3,
    "points": 5,
    "bonus": "sapphire",
    "cost": {
      "diamond": 7,
      "sapphire": 3,
      "emerald": 0,
      "ruby": 0,
      "onyx": 0
    }
  },
  {
    "id": "level-3-9",
    "level": 3,
    "points": 3,
    "bonus": "diamond",
    "cost": {
      "diamond": 0,
      "sapphire": 3,
      "emerald": 3,
      "ruby": 5,
      "onyx": 3
    }
  },
  {
    "id": "level-3-10",
    "level": 3,
    "points": 4,
    "bonus": "diamond",
    "cost": {
      "diamond": 0,
      "sapphire": 0,
      "emerald": 0,
      "ruby": 0,
      "onyx": 7
    }
  },
  {
    "id": "level-3-11",
    "level": 3,
    "points": 4,
    "bonus": "diamond",
    "cost": {
      "diamond": 3,
      "sapphire": 0,
      "emerald": 0,
      "ruby": 3,
      "onyx": 6
    }
  },
  {
    "id": "level-3-12",
    "level": 3,
    "points": 5,
    "bonus": "diamond",
    "cost": {
      "diamond": 3,
      "sapphire": 0,
      "emerald": 0,
      "ruby": 0,
      "onyx": 7
    }
  },
  {
    "id": "level-3-13",
    "level": 3,
    "points": 3,
    "bonus": "emerald",
    "cost": {
      "diamond": 5,
      "sapphire": 3,
      "emerald": 0,
      "ruby": 3,
      "onyx": 3
    }
  },
  {
    "id": "level-3-14",
    "level": 3,
    "points": 4,
    "bonus": "emerald",
    "cost": {
      "diamond": 0,
      "sapphire": 7,
      "emerald": 0,
      "ruby": 0,
      "onyx": 0
    }
  },
  {
    "id": "level-3-15",
    "level": 3,
    "points": 4,
    "bonus": "emerald",
    "cost": {
      "diamond": 3,
      "sapphire": 6,
      "emerald": 3,
      "ruby": 0,
      "onyx": 0
    }
  },
  {
    "id": "level-3-16",
    "level": 3,
    "points": 5,
    "bonus": "emerald",
    "cost": {
      "diamond": 0,
      "sapphire": 7,
      "emerald": 3,
      "ruby": 0,
      "onyx": 0
    }
  },
  {
    "id": "level-3-17",
    "level": 3,
    "points": 3,
    "bonus": "ruby",
    "cost": {
      "diamond": 3,
      "sapphire": 5,
      "emerald": 3,
      "ruby": 0,
      "onyx": 3
    }
  },
  {
    "id": "level-3-18",
    "level": 3,
    "points": 4,
    "bonus": "ruby",
    "cost": {
      "diamond": 0,
      "sapphire": 0,
      "emerald": 7,
      "ruby": 0,
      "onyx": 0
    }
  },
  {
    "id": "level-3-19",
    "level": 3,
    "points": 4,
    "bonus": "ruby",
    "cost": {
      "diamond": 0,
      "sapphire": 3,
      "emerald": 6,
      "ruby": 3,
      "onyx": 0
    }
  },
  {
    "id": "level-3-20",
    "level": 3,
    "points": 5,
    "bonus": "ruby",
    "cost": {
      "diamond": 0,
      "sapphire": 0,
      "emerald": 7,
      "ruby": 3,
      "onyx": 0
    }
  }
];

export const BASE_NOBLES: ReadonlyArray<Noble> = [
  {
    "id": "noble-1",
    "points": 3,
    "requirement": {
      "diamond": 0,
      "sapphire": 0,
      "emerald": 0,
      "ruby": 4,
      "onyx": 4
    }
  },
  {
    "id": "noble-2",
    "points": 3,
    "requirement": {
      "diamond": 0,
      "sapphire": 0,
      "emerald": 3,
      "ruby": 3,
      "onyx": 3
    }
  },
  {
    "id": "noble-3",
    "points": 3,
    "requirement": {
      "diamond": 0,
      "sapphire": 4,
      "emerald": 4,
      "ruby": 0,
      "onyx": 0
    }
  },
  {
    "id": "noble-4",
    "points": 3,
    "requirement": {
      "diamond": 4,
      "sapphire": 4,
      "emerald": 0,
      "ruby": 0,
      "onyx": 0
    }
  },
  {
    "id": "noble-5",
    "points": 3,
    "requirement": {
      "diamond": 3,
      "sapphire": 3,
      "emerald": 0,
      "ruby": 0,
      "onyx": 3
    }
  },
  {
    "id": "noble-6",
    "points": 3,
    "requirement": {
      "diamond": 0,
      "sapphire": 0,
      "emerald": 4,
      "ruby": 4,
      "onyx": 0
    }
  },
  {
    "id": "noble-7",
    "points": 3,
    "requirement": {
      "diamond": 0,
      "sapphire": 3,
      "emerald": 3,
      "ruby": 3,
      "onyx": 0
    }
  },
  {
    "id": "noble-8",
    "points": 3,
    "requirement": {
      "diamond": 4,
      "sapphire": 0,
      "emerald": 0,
      "ruby": 0,
      "onyx": 4
    }
  },
  {
    "id": "noble-9",
    "points": 3,
    "requirement": {
      "diamond": 3,
      "sapphire": 3,
      "emerald": 3,
      "ruby": 0,
      "onyx": 0
    }
  },
  {
    "id": "noble-10",
    "points": 3,
    "requirement": {
      "diamond": 3,
      "sapphire": 0,
      "emerald": 0,
      "ruby": 3,
      "onyx": 3
    }
  }
];

function cloneCard(card: Card): Card {
  return {
    ...card,
    cost: { ...card.cost }
  };
}

function cloneNoble(noble: Noble): Noble {
  return {
    ...noble,
    requirement: { ...noble.requirement }
  };
}

export function getBaseDevelopmentDecks(): {
  level1: Card[];
  level2: Card[];
  level3: Card[];
} {
  return {
    level1: BASE_LEVEL_1_CARDS.map(cloneCard),
    level2: BASE_LEVEL_2_CARDS.map(cloneCard),
    level3: BASE_LEVEL_3_CARDS.map(cloneCard)
  };
}

export function getBaseNoblePool(): Noble[] {
  return BASE_NOBLES.map(cloneNoble);
}
