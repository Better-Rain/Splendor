import React, { useEffect, useMemo, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import './App.css';
import {
  BONUS_COLORS,
  GEM_COLORS,
  RESERVED_CARD_LIMIT,
  TARGET_PRESTIGE_POINTS,
  TOKEN_LIMIT_PER_PLAYER
} from './shared/constants';
import {
  BonusColor,
  Card,
  GameAction,
  GamePlayer,
  GameState,
  Room,
  TokenSelection,
  TokenSupply,
  TurnLogEntry
} from './shared/types';

type Language = 'zh-CN' | 'en-US';

interface RoomJoinedPayload {
  room: Room;
  player: {
    id: string;
  };
}

interface SessionResumedPayload {
  room: Room;
  playerId: string;
}

interface NoticeState {
  tone: 'info' | 'success' | 'error';
  message: string;
}

interface PendingReturnAction {
  action: GameAction;
  actionLabel: string;
  projectedTokens: TokenSupply;
  overflow: number;
  submitNotice: string;
}

const CLIENT_ID_STORAGE_KEY = 'splendor-client-id';
const ROOM_ID_STORAGE_KEY = 'splendor-room-id';
const PLAYER_NAME_STORAGE_KEY = 'splendor-player-name';

const UI_COPY = {
  'zh-CN': {
    languageName: '中文',
    alternateLanguageLabel: 'English',
    eyebrow: '局域网桌游原型',
    appTitle: 'Splendor Desk',
    intro: '为“璀璨宝石”制作的主机权威结算桌面原型。',
    hostServiceOnline: '主机服务在线',
    hostServiceOffline: '主机服务离线',
    defaultNotice: '连接局域网主机，创建房间并率先冲到 15 声望。',
    connectedNotice: '已连接到本地主机服务。',
    disconnectedNotice: '与主机服务断开连接。',
    roomCreated: (id: string) => `房间已创建，请分享房间号 ${id}。`,
    joinedRoom: (name: string) => `已加入 ${name}。`,
    playerJoined: (name: string) => `${name} 已加入房间。`,
    copiedRoomCode: (id: string) => `已复制房间号 ${id}。`,
    matchStarted: '对局已开始，当前以主机状态为准。',
    playerSetupTitle: '玩家设置',
    playerSetupDescription: '先创建房主房间，再让局域网内其他玩家使用房间号加入。',
    displayName: '显示名称',
    displayNamePlaceholder: '输入你的名字',
    hostTableTitle: '创建房间',
    hostTableDescription: '在本机创建房间，并作为权威主机。',
    createRoom: '创建房间',
    joinTableTitle: '加入房间',
    joinTableDescription: '使用同一局域网内房主分享的房间号加入。',
    roomCode: '房间号',
    roomCodePlaceholder: '例如：AB12CD',
    joinRoom: '加入房间',
    currentRoom: '当前房间',
    roomCodeLabel: '房间号',
    copyCode: '复制房间号',
    startMatch: '开始对局',
    seatsTitle: '座位',
    seatsSummary: (count: number, status: string) => `当前 ${count} 位玩家，房间状态：${status}。`,
    seatLabel: (seat: number) => `座位 ${seat}`,
    youSuffix: '你',
    hostSuffix: '房主',
    connectedState: '已连接',
    disconnectedState: '已断线',
    matchTargetTitle: '对局目标',
    matchTargetDescription: `先到 ${TARGET_PRESTIGE_POINTS} 声望，随后公平打完这一轮。`,
    tokenHandLimit: '手牌上限',
    noblesRevealed: '贵族数量',
    gameStateTitle: '对局状态',
    turnStatus: (turn: number, playerName: string) => `第 ${turn} 回合，当前行动玩家：${playerName}。`,
    finishedMessage: (winners: string) => `对局结束。胜者：${winners}。`,
    bankTitle: '银行',
    yourTableauTitle: '你的面板',
    prestige: '声望',
    totalTokens: '宝石总数',
    bonuses: '奖励',
    nobles: '贵族',
    gold: '黄金',
    tokenUnit: '枚',
    bonusUnit: '奖励',
    actionPanelTitle: '操作面板',
    actionPanelDescription:
      '动作会先提交给主机校验；如果动作后会超过 10 枚宝石，界面会要求你先选择要归还的宝石。',
    takeDifferentTitle: '拿不同颜色宝石',
    takeDifferentDescription: '选择 1 到 3 种银行里仍有库存的宝石，再提交动作。',
    selectedDifferentGems: (count: number) => `已选择 ${count} / 3`,
    submitDifferentGems: (count: number) => `拿 ${count} 种不同宝石`,
    clearSelection: '清空选择',
    takeDifferent: (count: number) => `拿 ${count} 种不同宝石`,
    takeTwoSame: (color: string) => `拿 2 枚${color}`,
    reserveTopLevel: (level: number) => `预留 ${level} 级牌堆顶`,
    reserve: '预留',
    buy: '购买',
    buyReserved: '购买预留牌',
    actionSubmitted: (label: string) => `已提交动作：${label}。`,
    returnSelectionPrompt: (label: string, overflow: number) =>
      `${label} 会让你超出上限，请先选择要归还的 ${overflow} 枚宝石。`,
    marketTitle: '市场',
    levelTitle: (level: number) => `${level} 级`,
    marketCounts: (visible: number, left: number) => `${visible} 张明牌 | 牌堆剩余 ${left} 张`,
    reservedCardsTitle: '你的预留牌',
    noReservedCards: '暂时没有预留牌。',
    playersTitle: '玩家状态',
    currentTurn: '当前行动',
    waiting: '等待中',
    bought: '已购买',
    recentLogTitle: '最近日志',
    noActionLog: '还没有动作日志。',
    rulesSnapshotTitle: '规则速览',
    rulesSnapshotDescription: '当前版本聚焦基础版回合循环，不包含扩展与线上服务。',
    rulesSnapshot: [
      {
        title: '拿不同颜色宝石',
        detail: '一回合可拿 1 到 3 种不同颜色的宝石，各拿 1 枚。'
      },
      {
        title: '拿两枚同色宝石',
        detail: '只有该颜色在动作开始前至少有 4 枚时，才能拿 2 枚同色宝石。'
      },
      {
        title: '预留发展牌',
        detail: '可预留一张明牌或牌堆顶，若黄金充足则同步拿 1 枚黄金。'
      },
      {
        title: '购买发展牌',
        detail: '可购买市场明牌或自己的预留牌，永久奖励会自动参与折扣。'
      }
    ],
    wiredNowTitle: '当前已接通',
    wiredNow: [
      '拿不同色宝石与双宝石动作。',
      '预留明牌与预留牌堆顶。',
      '购买明牌与购买自己的预留牌。',
      '购买后自动结算贵族。',
      '终局触发与胜者判定。'
    ],
    knownGapsTitle: '当前原型缺口',
    knownGaps: [
      '主机进程关闭后还没有本地房间快照恢复。',
      '如果同时满足多个贵族，目前会自动拿第一个可选贵族。'
    ],
    returnPanelTitle: '归还宝石',
    returnPanelDescription: (overflow: number) =>
      `这一步执行后你会超过 ${TOKEN_LIMIT_PER_PLAYER} 枚宝石，请选择要归还的 ${overflow} 枚宝石。`,
    returnPanelSelected: (selected: number, overflow: number) => `已选择 ${selected} / ${overflow}`,
    returnPanelProjected: '动作执行后你的持有将变为：',
    confirmReturnAction: '确认并提交动作',
    cancel: '取消',
    decrease: '减少',
    increase: '增加',
    tokenReturnCount: '归还数量',
    noActiveMatch: '当前没有可操作的对局。',
    hiddenReserveNote: '牌堆顶预留现在只会对预留者本人显示具体牌面，其他玩家仅会看到预留数量与等级。',
    roomStatus: {
      open: '等待中',
      in_game: '进行中',
      closed: '已结束'
    }
  },
  'en-US': {
    languageName: 'English',
    alternateLanguageLabel: '中文',
    eyebrow: 'LAN tabletop prototype',
    appTitle: 'Splendor Desk',
    intro: 'A host-authoritative desktop prototype for Splendor.',
    hostServiceOnline: 'Host service online',
    hostServiceOffline: 'Host service offline',
    defaultNotice: 'Connect to a LAN host, create a table, and race to 15 prestige.',
    connectedNotice: 'Connected to the local host service.',
    disconnectedNotice: 'Disconnected from the host service.',
    roomCreated: (id: string) => `Table created. Share room code ${id}.`,
    joinedRoom: (name: string) => `Joined ${name}.`,
    playerJoined: (name: string) => `${name} joined the table.`,
    copiedRoomCode: (id: string) => `Copied room code ${id}.`,
    matchStarted: 'Match started. The host state is now authoritative.',
    playerSetupTitle: 'Player setup',
    playerSetupDescription: 'Start with a room host, then let other LAN players join by room code.',
    displayName: 'Display name',
    displayNamePlaceholder: 'Enter your name',
    hostTableTitle: 'Host a table',
    hostTableDescription: 'Create a local room and become the authoritative host.',
    createRoom: 'Create room',
    joinTableTitle: 'Join a table',
    joinTableDescription: 'Use a room code shared by the host on the same LAN.',
    roomCode: 'Room code',
    roomCodePlaceholder: 'Example: AB12CD',
    joinRoom: 'Join room',
    currentRoom: 'Current room',
    roomCodeLabel: 'Room code',
    copyCode: 'Copy code',
    startMatch: 'Start match',
    seatsTitle: 'Seats',
    seatsSummary: (count: number, status: string) => `${count} players joined, room status ${status}.`,
    seatLabel: (seat: number) => `Seat ${seat}`,
    youSuffix: 'you',
    hostSuffix: 'host',
    connectedState: 'connected',
    disconnectedState: 'disconnected',
    matchTargetTitle: 'Match target',
    matchTargetDescription: `Reach ${TARGET_PRESTIGE_POINTS} prestige, then finish the round fairly.`,
    tokenHandLimit: 'Token limit',
    noblesRevealed: 'Nobles revealed',
    gameStateTitle: 'Game state',
    turnStatus: (turn: number, playerName: string) => `Turn ${turn}. Active player: ${playerName}.`,
    finishedMessage: (winners: string) => `Match finished. Winner${winners.includes(',') ? 's' : ''}: ${winners}.`,
    bankTitle: 'Bank',
    yourTableauTitle: 'Your tableau',
    prestige: 'Prestige',
    totalTokens: 'Total tokens',
    bonuses: 'Bonuses',
    nobles: 'Nobles',
    gold: 'Gold',
    tokenUnit: 'tokens',
    bonusUnit: 'bonus',
    actionPanelTitle: 'Action panel',
    actionPanelDescription:
      'Actions are validated on the host; if the action would leave you above 10 tokens, you will be asked to pick tokens to return first.',
    takeDifferentTitle: 'Take different gems',
    takeDifferentDescription: 'Pick 1 to 3 available gem colors, then submit the move.',
    selectedDifferentGems: (count: number) => `${count} / 3 selected`,
    submitDifferentGems: (count: number) => `Take ${count} different gem${count === 1 ? '' : 's'}`,
    clearSelection: 'Clear selection',
    takeDifferent: (count: number) => `Take ${count} different gem${count === 1 ? '' : 's'}`,
    takeTwoSame: (color: string) => `Take 2 ${color}`,
    reserveTopLevel: (level: number) => `Reserve top of level ${level}`,
    reserve: 'Reserve',
    buy: 'Buy',
    buyReserved: 'Buy reserved',
    actionSubmitted: (label: string) => `Submitted action: ${label}.`,
    returnSelectionPrompt: (label: string, overflow: number) =>
      `${label} would leave you over the limit. Choose ${overflow} token(s) to return first.`,
    marketTitle: 'Market',
    levelTitle: (level: number) => `Level ${level}`,
    marketCounts: (visible: number, left: number) => `${visible} face-up | ${left} left in deck`,
    reservedCardsTitle: 'Your reserved cards',
    noReservedCards: 'No reserved cards yet.',
    playersTitle: 'Players',
    currentTurn: 'Current turn',
    waiting: 'Waiting',
    bought: 'bought',
    recentLogTitle: 'Recent log',
    noActionLog: 'No actions logged yet.',
    rulesSnapshotTitle: 'Rules snapshot',
    rulesSnapshotDescription: 'This build targets the base-game loop before expansions or online services.',
    rulesSnapshot: [
      {
        title: 'Take different gems',
        detail: 'On your turn you may take 1 to 3 different gem colors, one token each.'
      },
      {
        title: 'Take two of one color',
        detail: 'You may only take two of the same color if that color had at least 4 tokens beforehand.'
      },
      {
        title: 'Reserve a development',
        detail: 'Reserve a face-up card or the top of a deck, and take 1 gold if any remain.'
      },
      {
        title: 'Buy a development',
        detail: 'Buy a visible card or one of your reserved cards; bonuses automatically reduce cost.'
      }
    ],
    wiredNowTitle: 'What is wired now',
    wiredNow: [
      'Different-color token takes and double-token turns.',
      'Reserving visible cards and deck-top reserves.',
      'Buying visible cards and your own reserved cards.',
      'Automatic noble claims after purchases.',
      'Last-round trigger and winner resolution.'
    ],
    knownGapsTitle: 'Known prototype gaps',
    knownGaps: [
      'Local room snapshot restore after host process shutdown is not implemented yet.',
      'If multiple nobles are eligible at once, the first eligible noble is chosen automatically.'
    ],
    returnPanelTitle: 'Return tokens',
    returnPanelDescription: (overflow: number) =>
      `This move would leave you above ${TOKEN_LIMIT_PER_PLAYER} tokens. Choose ${overflow} token(s) to return.`,
    returnPanelSelected: (selected: number, overflow: number) => `${selected} / ${overflow} selected`,
    returnPanelProjected: 'After the action, your holdings would be:',
    confirmReturnAction: 'Confirm and submit',
    cancel: 'Cancel',
    decrease: 'Decrease',
    increase: 'Increase',
    tokenReturnCount: 'Return count',
    noActiveMatch: 'No active match is available right now.',
    hiddenReserveNote: 'Deck-top reserves now reveal the actual card only to the reserving player; others only see the count and level.',
    roomStatus: {
      open: 'open',
      in_game: 'in game',
      closed: 'closed'
    }
  }
} as const;

function getServerUrl(): string {
  if (window.location.protocol.startsWith('http')) {
    return `${window.location.protocol}//${window.location.hostname}:3001`;
  }

  return 'http://localhost:3001';
}

function getInitialLanguage(): Language {
  const stored = window.localStorage.getItem('splendor-language');
  if (stored === 'zh-CN' || stored === 'en-US') {
    return stored;
  }

  return window.navigator.language.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en-US';
}

function getClientId(): string {
  const stored = window.localStorage.getItem(CLIENT_ID_STORAGE_KEY);
  if (stored) {
    return stored;
  }

  const clientId = window.crypto.randomUUID();
  window.localStorage.setItem(CLIENT_ID_STORAGE_KEY, clientId);
  return clientId;
}

function getSavedRoomId(): string {
  return window.localStorage.getItem(ROOM_ID_STORAGE_KEY) ?? '';
}

function getSavedPlayerName(): string {
  return window.localStorage.getItem(PLAYER_NAME_STORAGE_KEY) ?? '';
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

function totalTokens(tokens: TokenSupply): number {
  return Object.values(tokens).reduce((sum, value) => sum + value, 0);
}

function cloneTokens(tokens: TokenSupply): TokenSupply {
  return {
    diamond: tokens.diamond,
    sapphire: tokens.sapphire,
    emerald: tokens.emerald,
    ruby: tokens.ruby,
    onyx: tokens.onyx,
    gold: tokens.gold
  };
}

function normalizeReturnedTokens(selection: TokenSupply): TokenSelection {
  const result: TokenSelection = {};

  for (const color of GEM_COLORS) {
    if (selection[color] > 0) {
      result[color] = selection[color];
    }
  }

  return result;
}

function canAffordCard(player: GamePlayer, card: Card): boolean {
  const goldNeeded = BONUS_COLORS.reduce((sum, color) => {
    const effectiveCost = Math.max(0, card.cost[color] - player.bonuses[color]);
    return sum + Math.max(0, effectiveCost - player.tokens[color]);
  }, 0);

  return goldNeeded <= player.tokens.gold;
}

function projectTokensAfterAction(
  player: GamePlayer,
  state: GameState,
  action: GameAction
): TokenSupply | null {
  const projected = cloneTokens(player.tokens);

  switch (action.type) {
    case 'take_three_distinct_tokens':
      for (const color of action.colors) {
        projected[color] += 1;
      }
      return projected;
    case 'take_two_same_tokens':
      projected[action.color] += 2;
      return projected;
    case 'reserve_card':
      if (state.gemSupply.gold > 0) {
        projected.gold += 1;
      }
      return projected;
    case 'purchase_card':
    case 'claim_noble':
      return null;
    default:
      return null;
  }
}

function formatCardCost(card: Card, tokenLabels: Record<'diamond' | 'sapphire' | 'emerald' | 'ruby' | 'onyx' | 'gold', string>) {
  return BONUS_COLORS.filter((color) => card.cost[color] > 0)
    .map((color) => `${tokenLabels[color]} ${card.cost[color]}`)
    .join(' | ');
}

function formatLogEntry(
  entry: TurnLogEntry,
  playersById: Map<string, GamePlayer>,
  language: Language,
  tokenLabels: Record<'diamond' | 'sapphire' | 'emerald' | 'ruby' | 'onyx' | 'gold', string>
): string {
  const playerName = playersById.get(entry.playerId)?.name ?? entry.playerId;

  switch (entry.type) {
    case 'take_three_distinct_tokens': {
      const colors = entry.details?.colors?.map((color) => tokenLabels[color]).join(', ') ?? entry.summary;
      return language === 'zh-CN'
        ? `${playerName} 拿取了 ${colors}。`
        : `${playerName} took ${colors}.`;
    }
    case 'take_two_same_tokens': {
      const color = entry.details?.color ? tokenLabels[entry.details.color] : entry.summary;
      return language === 'zh-CN'
        ? `${playerName} 拿取了 2 枚${color}。`
        : `${playerName} took 2 ${color}.`;
    }
    case 'reserve_card': {
      const cardId = entry.details?.cardId;
      const fromDeck = entry.details?.source === 'deck';
      if (!cardId && fromDeck) {
        return language === 'zh-CN'
          ? `${playerName} 从牌堆顶预留了一张牌。`
          : `${playerName} reserved a card from the deck.`;
      }
      return language === 'zh-CN'
        ? `${playerName} 预留了 ${cardId ?? '卡牌'}${fromDeck ? '（牌堆顶）' : ''}。`
        : `${playerName} reserved ${cardId ?? 'a card'}${fromDeck ? ' from the deck' : ''}.`;
    }
    case 'purchase_card': {
      const cardId = entry.details?.cardId ?? 'card';
      return language === 'zh-CN'
        ? `${playerName} 购买了 ${cardId}。`
        : `${playerName} purchased ${cardId}.`;
    }
    case 'claim_noble': {
      const nobleId = entry.details?.nobleId ?? 'noble';
      return language === 'zh-CN'
        ? `${playerName} 获得了贵族 ${nobleId}。`
        : `${playerName} claimed noble ${nobleId}.`;
    }
    default:
      return entry.summary;
  }
}

const App: React.FC = () => {
  const [language, setLanguage] = useState<Language>(getInitialLanguage);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [roomId, setRoomId] = useState(getSavedRoomId);
  const [playerName, setPlayerName] = useState(getSavedPlayerName);
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [localPlayerId, setLocalPlayerId] = useState<string | null>(null);
  const [selectedDistinctColors, setSelectedDistinctColors] = useState<BonusColor[]>([]);
  const [pendingReturnAction, setPendingReturnAction] = useState<PendingReturnAction | null>(null);
  const [returnedTokens, setReturnedTokens] = useState<TokenSupply>(createEmptyTokenSupply);
  const [notice, setNotice] = useState<NoticeState>({
    tone: 'info',
    message: UI_COPY[getInitialLanguage()].defaultNotice
  });
  const languageRef = useRef<Language>(language);
  const clientIdRef = useRef<string>(getClientId());

  const copy = UI_COPY[language];
  const tokenLabels = useMemo(
    () =>
      ({
        diamond: language === 'zh-CN' ? '钻石' : 'Diamond',
        sapphire: language === 'zh-CN' ? '蓝宝石' : 'Sapphire',
        emerald: language === 'zh-CN' ? '祖母绿' : 'Emerald',
        ruby: language === 'zh-CN' ? '红宝石' : 'Ruby',
        onyx: language === 'zh-CN' ? '玛瑙' : 'Onyx',
        gold: language === 'zh-CN' ? '黄金' : 'Gold'
      }) as Record<'diamond' | 'sapphire' | 'emerald' | 'ruby' | 'onyx' | 'gold', string>,
    [language]
  );

  useEffect(() => {
    languageRef.current = language;
  }, [language]);

  useEffect(() => {
    window.localStorage.setItem('splendor-language', language);
  }, [language]);

  useEffect(() => {
    window.localStorage.setItem(PLAYER_NAME_STORAGE_KEY, playerName);
  }, [playerName]);

  useEffect(() => {
    const nextSocket = io(getServerUrl());
    setSocket(nextSocket);

    nextSocket.on('connect', () => {
      setConnected(true);
      setNotice({
        tone: 'success',
        message: UI_COPY[languageRef.current].connectedNotice
      });

      const savedRoomId = getSavedRoomId();
      if (savedRoomId) {
        nextSocket.emit('resume-session', {
          roomId: savedRoomId,
          clientId: clientIdRef.current
        });
      }
    });

    nextSocket.on('disconnect', () => {
      setConnected(false);
      setNotice({
        tone: 'error',
        message: UI_COPY[languageRef.current].disconnectedNotice
      });
    });

    nextSocket.on('room-created', (id: string) => {
      setRoomId(id);
      setNotice({
        tone: 'success',
        message: UI_COPY[languageRef.current].roomCreated(id)
      });
    });

    nextSocket.on('room-joined', ({ room, player }: RoomJoinedPayload) => {
      setCurrentRoom(room);
      setGameState(room.gameState);
      setLocalPlayerId(player.id);
      setGameStarted(room.status === 'in_game' || !!room.gameState);
      window.localStorage.setItem(ROOM_ID_STORAGE_KEY, room.id);
      const joinedPlayer = room.players.find((candidate) => candidate.id === player.id);
      if (joinedPlayer) {
        setPlayerName(joinedPlayer.name);
      }
      setNotice({
        tone: 'success',
        message: UI_COPY[languageRef.current].joinedRoom(room.name)
      });
    });

    nextSocket.on('session-resumed', ({ room, playerId }: SessionResumedPayload) => {
      setCurrentRoom(room);
      setGameState(room.gameState);
      setLocalPlayerId(playerId);
      setRoomId(room.id);
      setGameStarted(room.status === 'in_game' || room.status === 'closed' || !!room.gameState);
      window.localStorage.setItem(ROOM_ID_STORAGE_KEY, room.id);
      const resumedPlayer = room.players.find((candidate) => candidate.id === playerId);
      if (resumedPlayer) {
        setPlayerName(resumedPlayer.name);
      }
      setNotice({
        tone: 'success',
        message:
          languageRef.current === 'zh-CN'
            ? `已恢复到房间 ${room.name}。`
            : `Resumed session in ${room.name}.`
      });
    });

    nextSocket.on('session-resume-failed', () => {
      window.localStorage.removeItem(ROOM_ID_STORAGE_KEY);
      setCurrentRoom(null);
      setGameState(null);
      setGameStarted(false);
      setNotice({
        tone: 'info',
        message:
          languageRef.current === 'zh-CN'
            ? '未能恢复上次会话，请重新加入房间。'
            : 'Could not restore the previous session. Please join a room again.'
      });
    });

    nextSocket.on('room-updated', (room: Room) => {
      setCurrentRoom(room);
      setGameState(room.gameState);
      setGameStarted(room.status === 'in_game' || room.status === 'closed' || !!room.gameState);
    });

    nextSocket.on('game-state-updated', (state: GameState) => {
      setGameState(state);
      setGameStarted(true);
      setPendingReturnAction(null);
      setReturnedTokens(createEmptyTokenSupply());
    });

    nextSocket.on('player-joined', (player: { name: string }) => {
      setNotice({
        tone: 'info',
        message: UI_COPY[languageRef.current].playerJoined(player.name)
      });
    });

    nextSocket.on('join-error', (message: string) => {
      setNotice({
        tone: 'error',
        message
      });
    });

    nextSocket.on('game-started', (state: GameState) => {
      setGameStarted(true);
      setGameState(state);
      setNotice({
        tone: 'success',
        message: UI_COPY[languageRef.current].matchStarted
      });
    });

    nextSocket.on('game-error', (message: string) => {
      setNotice({
        tone: 'error',
        message
      });
    });

    return () => {
      nextSocket.disconnect();
    };
  }, []);

  const seatedPlayers = useMemo(
    () => [...(currentRoom?.players ?? [])].sort((left, right) => left.seat - right.seat),
    [currentRoom]
  );

  const activePlayer = gameState?.players[gameState.currentPlayerIndex] ?? null;
  const playersById = useMemo(
    () => new Map((gameState?.players ?? []).map((player) => [player.id, player] as const)),
    [gameState]
  );
  const localRoomPlayer = useMemo(
    () => seatedPlayers.find((player) => player.id === localPlayerId) ?? null,
    [localPlayerId, seatedPlayers]
  );
  const localGamePlayer = useMemo(
    () => gameState?.players.find((player) => player.id === localPlayerId) ?? null,
    [gameState, localPlayerId]
  );
  const localTokenCount = localGamePlayer ? totalTokens(localGamePlayer.tokens) : 0;
  const isLocalPlayersTurn = !!(
    gameState &&
    localGamePlayer &&
    activePlayer &&
    localGamePlayer.id === activePlayer.id &&
    gameState.phase !== 'finished'
  );
  const winners = useMemo(
    () =>
      gameState?.winnerIds
        .map((winnerId) => gameState.players.find((player) => player.id === winnerId)?.name ?? winnerId)
        .join(language === 'zh-CN' ? '、' : ', ') ?? '',
    [gameState, language]
  );
  const selectedReturnedCount = useMemo(() => totalTokens(returnedTokens), [returnedTokens]);
  const selectedDistinctColorSet = useMemo(
    () => new Set(selectedDistinctColors),
    [selectedDistinctColors]
  );
  const canSubmitDistinctTake =
    isLocalPlayersTurn &&
    selectedDistinctColors.length > 0 &&
    selectedDistinctColors.every((color) => (gameState?.gemSupply[color] ?? 0) > 0);

  useEffect(() => {
    if (localRoomPlayer && playerName !== localRoomPlayer.name) {
      setPlayerName(localRoomPlayer.name);
    }
  }, [localRoomPlayer, playerName]);

  useEffect(() => {
    setSelectedDistinctColors((current) =>
      current.filter((color) => (gameState?.gemSupply[color] ?? 0) > 0).slice(0, 3)
    );
  }, [gameState]);

  useEffect(() => {
    if (!isLocalPlayersTurn && selectedDistinctColors.length > 0) {
      setSelectedDistinctColors([]);
    }
  }, [isLocalPlayersTurn, selectedDistinctColors.length]);

  const createRoom = () => {
    if (socket && playerName.trim()) {
      socket.emit('create-room', {
        roomName: `${playerName.trim()}'s Table`,
        playerName: playerName.trim(),
        clientId: clientIdRef.current
      });
    }
  };

  const joinRoom = () => {
    if (socket && roomId.trim() && playerName.trim()) {
      socket.emit('join-room', roomId.trim().toUpperCase(), {
        name: playerName.trim(),
        clientId: clientIdRef.current
      });
    }
  };

  const startGame = () => {
    if (socket && currentRoom) {
      socket.emit('start-game', currentRoom.id);
    }
  };

  const copyRoomCode = async () => {
    if (!currentRoom?.id || !navigator.clipboard) {
      return;
    }

    await navigator.clipboard.writeText(currentRoom.id);
    setNotice({
      tone: 'info',
      message: copy.copiedRoomCode(currentRoom.id)
    });
  };

  const submitAction = (action: GameAction, pendingMessage: string) => {
    if (!socket || !currentRoom) {
      return;
    }

    socket.emit('game-action', currentRoom.id, action);
    setNotice({
      tone: 'info',
      message: pendingMessage
    });
  };

  const queueAction = (action: GameAction, actionLabel: string) => {
    if (!localGamePlayer || !gameState) {
      return;
    }

    const projectedTokens = projectTokensAfterAction(localGamePlayer, gameState, action);
    const submitNotice = copy.actionSubmitted(actionLabel);

    if (!projectedTokens) {
      submitAction(action, submitNotice);
      return;
    }

    const overflow = totalTokens(projectedTokens) - TOKEN_LIMIT_PER_PLAYER;
    if (overflow > 0) {
      setPendingReturnAction({
        action,
        actionLabel,
        projectedTokens,
        overflow,
        submitNotice
      });
      setReturnedTokens(createEmptyTokenSupply());
      setNotice({
        tone: 'info',
        message: copy.returnSelectionPrompt(actionLabel, overflow)
      });
      return;
    }

    submitAction(action, submitNotice);
  };

  const cancelPendingReturnAction = () => {
    setPendingReturnAction(null);
    setReturnedTokens(createEmptyTokenSupply());
    setNotice({
      tone: 'info',
      message: copy.defaultNotice
    });
  };

  const changeReturnedToken = (color: keyof TokenSupply, delta: -1 | 1) => {
    if (!pendingReturnAction) {
      return;
    }

    setReturnedTokens((current) => {
      const next = cloneTokens(current);
      const currentSelected = totalTokens(current);

      if (delta === -1) {
        next[color] = Math.max(0, next[color] - 1);
        return next;
      }

      if (currentSelected >= pendingReturnAction.overflow) {
        return current;
      }

      if (next[color] >= pendingReturnAction.projectedTokens[color]) {
        return current;
      }

      next[color] += 1;
      return next;
    });
  };

  const toggleLanguage = () => {
    const nextLanguage: Language = language === 'zh-CN' ? 'en-US' : 'zh-CN';
    setLanguage(nextLanguage);
    setNotice({
      tone: 'info',
      message: UI_COPY[nextLanguage].defaultNotice
    });
  };

  const toggleDistinctColor = (color: BonusColor) => {
    if (!isLocalPlayersTurn || (gameState?.gemSupply[color] ?? 0) <= 0) {
      return;
    }

    setSelectedDistinctColors((current) => {
      if (current.includes(color)) {
        return current.filter((selectedColor) => selectedColor !== color);
      }

      if (current.length >= 3) {
        return current;
      }

      return [...current, color];
    });
  };

  const submitDistinctTake = () => {
    if (!canSubmitDistinctTake) {
      return;
    }

    queueAction(
      {
        type: 'take_three_distinct_tokens',
        colors: selectedDistinctColors
      },
      copy.takeDifferent(selectedDistinctColors.length)
    );
    setSelectedDistinctColors([]);
  };

  const confirmPendingReturnAction = () => {
    if (!pendingReturnAction) {
      return;
    }

    if (selectedReturnedCount !== pendingReturnAction.overflow) {
      return;
    }

    const actionWithReturns: GameAction = {
      ...pendingReturnAction.action,
      returnedTokens: normalizeReturnedTokens(returnedTokens)
    } as GameAction;

    submitAction(actionWithReturns, pendingReturnAction.submitNotice);
    setPendingReturnAction(null);
    setReturnedTokens(createEmptyTokenSupply());
  };

  const renderCard = (card: Card, source: 'board' | 'reserved') => {
    const affordable = localGamePlayer ? canAffordCard(localGamePlayer, card) : false;
    const canReserve =
      !!localGamePlayer &&
      isLocalPlayersTurn &&
      localGamePlayer.reservedCards.length < RESERVED_CARD_LIMIT;
    const canBuy = !!localGamePlayer && isLocalPlayersTurn && affordable;

    return (
      <div className="development-card" key={`${source}-${card.id}`}>
        <div className="development-card-header">
          <span className={`bonus-badge bonus-${card.bonus}`}>{tokenLabels[card.bonus]}</span>
          <strong>{card.points} pt</strong>
        </div>
        <div className="development-card-body">
          <p className="card-id">{card.id}</p>
          <p>{formatCardCost(card, tokenLabels)}</p>
        </div>
        {source === 'board' ? (
          <div className="card-actions">
            <button
              className="secondary"
              disabled={!canReserve}
              onClick={() =>
                queueAction(
                  {
                    type: 'reserve_card',
                    level: card.level,
                    cardId: card.id,
                    source: 'board'
                  },
                  `${copy.reserve} ${card.id}`
                )
              }
            >
              {copy.reserve}
            </button>
            <button
              disabled={!canBuy}
              onClick={() =>
                queueAction(
                  {
                    type: 'purchase_card',
                    level: card.level,
                    cardId: card.id,
                    source: 'board'
                  },
                  `${copy.buy} ${card.id}`
                )
              }
            >
              {copy.buy}
            </button>
          </div>
        ) : (
          <div className="card-actions">
            <button
              disabled={!canBuy}
              onClick={() =>
                queueAction(
                  {
                    type: 'purchase_card',
                    level: card.level,
                    cardId: card.id,
                    source: 'reserved'
                  },
                  `${copy.buyReserved} ${card.id}`
                )
              }
            >
              {copy.buyReserved}
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">{copy.eyebrow}</p>
          <h1>{copy.appTitle}</h1>
          <p className="intro">{copy.intro}</p>
        </div>
        <div className="header-actions">
          <button
            className="secondary language-toggle"
            onClick={toggleLanguage}
          >
            {copy.alternateLanguageLabel}
          </button>
          <div className={`status-pill ${connected ? 'online' : 'offline'}`}>
            {connected ? copy.hostServiceOnline : copy.hostServiceOffline}
          </div>
        </div>
      </header>

      <main className="workspace">
        <section className="panel panel-primary">
          <div className={`notice notice-${notice.tone}`}>{notice.message}</div>

          <div className="panel-block">
            <div className="section-heading">
              <h2>{copy.playerSetupTitle}</h2>
              <p>{copy.playerSetupDescription}</p>
            </div>

            <label className="field">
              <span>{copy.displayName}</span>
              <input
                type="text"
                value={playerName}
                onChange={(event) => setPlayerName(event.target.value)}
                placeholder={copy.displayNamePlaceholder}
              />
            </label>
          </div>

          <div className="panel-grid">
            <div className="card">
              <h3>{copy.hostTableTitle}</h3>
              <p>{copy.hostTableDescription}</p>
              <button onClick={createRoom} disabled={!playerName.trim() || !connected}>
                {copy.createRoom}
              </button>
            </div>

            <div className="card">
              <h3>{copy.joinTableTitle}</h3>
              <p>{copy.joinTableDescription}</p>
              <label className="field">
                <span>{copy.roomCode}</span>
                <input
                  type="text"
                  value={roomId}
                  onChange={(event) => setRoomId(event.target.value)}
                  placeholder={copy.roomCodePlaceholder}
                />
              </label>
              <button
                onClick={joinRoom}
                disabled={!playerName.trim() || !roomId.trim() || !connected}
              >
                {copy.joinRoom}
              </button>
            </div>
          </div>

          {currentRoom && (
            <div className="room-surface">
              <div className="room-meta">
                <div>
                  <p className="eyebrow">{copy.currentRoom}</p>
                  <h2>{currentRoom.name}</h2>
                  <p className="room-code">
                    {copy.roomCodeLabel} {currentRoom.id}
                  </p>
                </div>
                <div className="room-actions">
                  <button className="secondary" onClick={copyRoomCode}>
                    {copy.copyCode}
                  </button>
                  {localRoomPlayer?.isHost && !gameStarted && (
                    <button onClick={startGame} disabled={seatedPlayers.length < 2}>
                      {copy.startMatch}
                    </button>
                  )}
                </div>
              </div>

              <div className="room-columns">
                <div>
                  <div className="section-heading compact">
                    <h3>{copy.seatsTitle}</h3>
                    <p>
                      {copy.seatsSummary(
                        seatedPlayers.length,
                        copy.roomStatus[currentRoom.status]
                      )}
                    </p>
                  </div>
                  <ul className="player-list">
                    {seatedPlayers.map((player) => (
                      <li key={player.id} className={player.connectionState === 'connected' ? '' : 'muted'}>
                        <div>
                          <strong>{player.name}</strong>
                          <span>
                            {copy.seatLabel(player.seat + 1)}
                            {player.isHost ? ` | ${copy.hostSuffix}` : ''}
                            {player.id === localPlayerId ? ` | ${copy.youSuffix}` : ''}
                          </span>
                        </div>
                        <span className="chip">
                          {player.connectionState === 'connected'
                            ? copy.connectedState
                            : copy.disconnectedState}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="summary-card">
                  <h3>{copy.matchTargetTitle}</h3>
                  <p>{copy.matchTargetDescription}</p>
                  <div className="summary-stats">
                    <div>
                      <span>{copy.tokenHandLimit}</span>
                      <strong>{TOKEN_LIMIT_PER_PLAYER}</strong>
                    </div>
                    <div>
                      <span>{copy.noblesRevealed}</span>
                      <strong>{Math.min(seatedPlayers.length + 1, 5)}</strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {gameStarted && gameState && (
            <div className="game-shell">
              <div className="section-heading">
                <h2>{copy.gameStateTitle}</h2>
                <p>{copy.turnStatus(gameState.turnNumber, activePlayer?.name ?? 'Unknown')}</p>
              </div>

              {gameState.phase === 'finished' && (
                <div className="notice notice-success">{copy.finishedMessage(winners)}</div>
              )}

              <div className="board-grid">
                <div className="summary-card">
                  <h3>{copy.bankTitle}</h3>
                  <div className="token-grid">
                    {BONUS_COLORS.map((color) => (
                      <div className="token-chip" key={color}>
                        <span>{tokenLabels[color]}</span>
                        <strong>{gameState.gemSupply[color]}</strong>
                      </div>
                    ))}
                    <div className="token-chip token-chip-gold">
                      <span>{copy.gold}</span>
                      <strong>{gameState.gemSupply.gold}</strong>
                    </div>
                  </div>
                </div>

                {localGamePlayer && (
                  <div className="summary-card">
                    <h3>{copy.yourTableauTitle}</h3>
                    <div className="market-stats">
                      <div>
                        <span>{copy.prestige}</span>
                        <strong>{localGamePlayer.points}</strong>
                      </div>
                      <div>
                        <span>{copy.totalTokens}</span>
                        <strong>{localTokenCount}</strong>
                      </div>
                      <div>
                        <span>{copy.bonuses}</span>
                        <strong>{BONUS_COLORS.map((color) => localGamePlayer.bonuses[color]).join(' / ')}</strong>
                      </div>
                      <div>
                        <span>{copy.nobles}</span>
                        <strong>{localGamePlayer.nobles.length}</strong>
                      </div>
                    </div>
                    <div className="token-grid token-grid-player">
                      {BONUS_COLORS.map((color) => (
                        <div className="token-chip" key={`player-${color}`}>
                          <span>{tokenLabels[color]}</span>
                          <strong>
                            {localGamePlayer.tokens[color]} {copy.tokenUnit} | {localGamePlayer.bonuses[color]}{' '}
                            {copy.bonusUnit}
                          </strong>
                        </div>
                      ))}
                      <div className="token-chip token-chip-gold">
                        <span>{copy.gold}</span>
                        <strong>{localGamePlayer.tokens.gold}</strong>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {pendingReturnAction && (
                <div className="summary-card return-panel">
                  <h3>{copy.returnPanelTitle}</h3>
                  <p>{copy.returnPanelDescription(pendingReturnAction.overflow)}</p>
                  <p className="return-summary">
                    {copy.returnPanelSelected(selectedReturnedCount, pendingReturnAction.overflow)}
                  </p>
                  <p>{copy.returnPanelProjected}</p>
                  <div className="token-grid token-grid-player">
                    {GEM_COLORS.map((color) => (
                      <div className="token-chip" key={`projected-${color}`}>
                        <span>{tokenLabels[color]}</span>
                        <strong>{pendingReturnAction.projectedTokens[color]}</strong>
                      </div>
                    ))}
                  </div>
                  <div className="return-grid">
                    {GEM_COLORS.map((color) => (
                      <div className="return-row" key={`return-${color}`}>
                        <div>
                          <strong>{tokenLabels[color]}</strong>
                          <span>
                            {copy.tokenReturnCount}: {returnedTokens[color]}
                          </span>
                        </div>
                        <div className="counter-controls">
                          <button
                            className="secondary"
                            onClick={() => changeReturnedToken(color, -1)}
                            disabled={returnedTokens[color] === 0}
                          >
                            -
                          </button>
                          <button
                            className="secondary"
                            onClick={() => changeReturnedToken(color, 1)}
                            disabled={
                              selectedReturnedCount >= pendingReturnAction.overflow ||
                              returnedTokens[color] >= pendingReturnAction.projectedTokens[color]
                            }
                          >
                            +
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="card-actions">
                    <button className="secondary" onClick={cancelPendingReturnAction}>
                      {copy.cancel}
                    </button>
                    <button
                      onClick={confirmPendingReturnAction}
                      disabled={selectedReturnedCount !== pendingReturnAction.overflow}
                    >
                      {copy.confirmReturnAction}
                    </button>
                  </div>
                </div>
              )}

              <div className="summary-card">
                <h3>{copy.actionPanelTitle}</h3>
                <p>{copy.actionPanelDescription}</p>
                <div className="distinct-token-picker">
                  <div>
                    <strong>{copy.takeDifferentTitle}</strong>
                    <p>{copy.takeDifferentDescription}</p>
                  </div>
                  <div className="gem-select-grid">
                    {BONUS_COLORS.map((color) => {
                      const selected = selectedDistinctColorSet.has(color);
                      const unavailable = (gameState?.gemSupply[color] ?? 0) <= 0;
                      return (
                        <button
                          className={`gem-select-button bonus-${color}${selected ? ' selected' : ''}`}
                          key={`distinct-${color}`}
                          disabled={!isLocalPlayersTurn || unavailable || (!selected && selectedDistinctColors.length >= 3)}
                          onClick={() => toggleDistinctColor(color)}
                        >
                          <span>{tokenLabels[color]}</span>
                          <strong>{gameState?.gemSupply[color] ?? 0}</strong>
                        </button>
                      );
                    })}
                  </div>
                  <div className="distinct-token-actions">
                    <span>{copy.selectedDifferentGems(selectedDistinctColors.length)}</span>
                    <div className="card-actions">
                      <button
                        className="secondary"
                        disabled={selectedDistinctColors.length === 0}
                        onClick={() => setSelectedDistinctColors([])}
                      >
                        {copy.clearSelection}
                      </button>
                      <button disabled={!canSubmitDistinctTake} onClick={submitDistinctTake}>
                        {copy.submitDifferentGems(selectedDistinctColors.length)}
                      </button>
                    </div>
                  </div>
                </div>
                <div className="action-grid">
                  {BONUS_COLORS.map((color) => (
                    <button
                      key={`double-${color}`}
                      disabled={!isLocalPlayersTurn || (gameState?.gemSupply[color] ?? 0) < 4}
                      onClick={() =>
                        queueAction(
                          {
                            type: 'take_two_same_tokens',
                            color
                          },
                          copy.takeTwoSame(tokenLabels[color])
                        )
                      }
                    >
                      {copy.takeTwoSame(tokenLabels[color])}
                    </button>
                  ))}
                  {[1, 2, 3].map((level) => (
                    <button
                      className="secondary"
                      key={`deck-${level}`}
                      disabled={
                        !isLocalPlayersTurn ||
                        !localGamePlayer ||
                        localGamePlayer.reservedCards.length >= RESERVED_CARD_LIMIT ||
                        (gameState?.decks[`level${level}` as 'level1' | 'level2' | 'level3'].length ?? 0) === 0
                      }
                      onClick={() =>
                        queueAction(
                          {
                            type: 'reserve_card',
                            level: level as 1 | 2 | 3,
                            source: 'deck'
                          },
                          copy.reserveTopLevel(level)
                        )
                      }
                    >
                      {copy.reserveTopLevel(level)}
                    </button>
                  ))}
                </div>
                <p className="helper-note">{copy.hiddenReserveNote}</p>
              </div>

              <div className="summary-card">
                <h3>{copy.marketTitle}</h3>
                <div className="market-columns">
                  {(['level1', 'level2', 'level3'] as const).map((levelKey, index) => (
                    <div key={levelKey}>
                      <div className="section-heading compact">
                        <h3>{copy.levelTitle(index + 1)}</h3>
                        <p>
                          {copy.marketCounts(
                            gameState.visibleCards[levelKey].length,
                            gameState.decks[levelKey].length
                          )}
                        </p>
                      </div>
                      <div className="card-grid">
                        {gameState.visibleCards[levelKey].map((card) => renderCard(card, 'board'))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {localGamePlayer && (
                <div className="summary-card">
                  <h3>{copy.reservedCardsTitle}</h3>
                  {localGamePlayer.reservedCards.length > 0 ? (
                    <div className="card-grid">
                      {localGamePlayer.reservedCards
                        .filter((reservedCard) => reservedCard.card)
                        .map((reservedCard) => renderCard(reservedCard.card as Card, 'reserved'))}
                    </div>
                  ) : (
                    <p>{copy.noReservedCards}</p>
                  )}
                </div>
              )}

              <div className="summary-card">
                <h3>{copy.playersTitle}</h3>
                <div className="player-table">
                  {gameState.players.map((player) => (
                    <div className="player-row" key={player.id}>
                      <div>
                        <strong>{player.name}</strong>
                        <span>
                          {player.id === activePlayer?.id ? copy.currentTurn : copy.waiting} |{' '}
                          {player.connectionState === 'connected'
                            ? copy.connectedState
                            : copy.disconnectedState}
                        </span>
                      </div>
                      <div className="player-metrics">
                        <span>
                          {player.points} {copy.prestige}
                        </span>
                        <span>
                          {player.reservedCards.length} {copy.reserve}
                        </span>
                        <span>
                          {player.purchasedCards.length} {copy.bought}
                        </span>
                        <span>
                          {player.nobles.length} {copy.nobles}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="summary-card">
                <h3>{copy.recentLogTitle}</h3>
                {gameState.log.length > 0 ? (
                  <div className="log-list">
                    {[...gameState.log].slice(-8).reverse().map((entry, index) => (
                      <div className="log-entry" key={`${entry.createdAt}-${index}`}>
                        <strong>{language === 'zh-CN' ? `第 ${entry.turn} 回合` : `Turn ${entry.turn}`}</strong>
                        <span>{formatLogEntry(entry, playersById, language, tokenLabels)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p>{copy.noActionLog}</p>
                )}
              </div>
            </div>
          )}

          {!gameStarted && currentRoom?.status === 'closed' && (
            <div className="summary-card">
              <p>{copy.noActiveMatch}</p>
            </div>
          )}
        </section>

        <aside className="panel panel-secondary">
          <div className="section-heading">
            <h2>{copy.rulesSnapshotTitle}</h2>
            <p>{copy.rulesSnapshotDescription}</p>
          </div>

          <div className="rules-list">
            {copy.rulesSnapshot.map((rule) => (
              <div className="rule-card" key={rule.title}>
                <h3>{rule.title}</h3>
                <p>{rule.detail}</p>
              </div>
            ))}
          </div>

          <div className="summary-card">
            <h3>{copy.wiredNowTitle}</h3>
            <ul className="plain-list">
              {copy.wiredNow.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>

          <div className="summary-card">
            <h3>{copy.knownGapsTitle}</h3>
            <ul className="plain-list">
              {copy.knownGaps.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </aside>
      </main>
    </div>
  );
};

export default App;
