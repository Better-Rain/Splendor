import express from 'express';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import http from 'http';
import path from 'node:path';
import { Server } from 'socket.io';
import { MAX_PLAYERS_PER_ROOM, MIN_PLAYERS_PER_ROOM } from '../shared/constants';
import { BonusMap, Card, GameAction, GameState, LobbyPlayer, Noble, ReservedCard, Room } from '../shared/types';
import { applyGameAction, canStartGame, GameRuleError, initializeGame } from './gameLogic';

interface CreateRoomPayload {
  roomName: string;
  playerName: string;
  clientId: string;
}

interface JoinRoomPayload {
  name: string;
  clientId: string;
}

interface ResumeSessionPayload {
  roomId: string;
  clientId: string;
}

interface PlayerSession {
  roomId: string;
  clientId: string;
  socketId: string | null;
}

interface StartServerOptions {
  port?: number;
  silent?: boolean;
  snapshotPath?: string | null;
}

interface PersistedPlayerSession {
  roomId: string;
  playerId: string;
  clientId: string;
}

interface HostSnapshot {
  version: 1;
  savedAt: string;
  rooms: Room[];
  sessions: PersistedPlayerSession[];
}

const LOBBY_RECONNECT_WINDOW_MS = 120000;
const SNAPSHOT_VERSION = 1;

function now(): string {
  return new Date().toISOString();
}

function sanitizePlayerName(name: string): string {
  return name.trim().slice(0, 24) || 'Player';
}

function sanitizeRoomName(name: string, playerName: string): string {
  const trimmed = name.trim().slice(0, 32);
  return trimmed || `${playerName}'s Table`;
}

function createLobbyPlayer(playerId: string, name: string, seat: number, isHost: boolean): LobbyPlayer {
  return {
    id: playerId,
    name,
    isHost,
    seat,
    joinedAt: now(),
    connectionState: 'connected'
  };
}

function getDefaultSnapshotPath(): string {
  return process.env.SPLENDOR_SNAPSHOT_PATH ?? path.join(process.cwd(), 'database', 'host-snapshot.json');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function normalizeLoadedRoom(room: Room): Room {
  return {
    ...room,
    players: room.players.map((player) => ({
      ...player,
      connectionState: 'disconnected'
    })),
    gameState: room.gameState
      ? {
          ...room.gameState,
          players: room.gameState.players.map((player) => ({
            ...player,
            connectionState: 'disconnected'
          }))
        }
      : null
  };
}

function readHostSnapshot(snapshotPath: string, silent?: boolean): HostSnapshot | null {
  if (!existsSync(snapshotPath)) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(readFileSync(snapshotPath, 'utf8'));
    if (!isRecord(parsed)) {
      return null;
    }

    if (parsed.version !== SNAPSHOT_VERSION || !Array.isArray(parsed.rooms) || !Array.isArray(parsed.sessions)) {
      return null;
    }

    return {
      version: SNAPSHOT_VERSION,
      savedAt: typeof parsed.savedAt === 'string' ? parsed.savedAt : now(),
      rooms: parsed.rooms as Room[],
      sessions: parsed.sessions.filter((session): session is PersistedPlayerSession => {
        if (!isRecord(session)) {
          return false;
        }

        return (
          typeof session.roomId === 'string' &&
          typeof session.playerId === 'string' &&
          typeof session.clientId === 'string'
        );
      })
    };
  } catch (error) {
    if (!silent) {
      console.warn('Could not read host snapshot:', error);
    }
    return null;
  }
}

function reseatPlayers(room: Room): void {
  room.players = room.players.map((player, index) => ({
    ...player,
    seat: index,
    isHost: player.id === room.hostId
  }));
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

function createHiddenDeck(level: 1 | 2 | 3, count: number): Card[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `hidden-level-${level}-${index + 1}`,
    level,
    points: 0,
    bonus: 'diamond',
    cost: {
      diamond: 0,
      sapphire: 0,
      emerald: 0,
      ruby: 0,
      onyx: 0
    }
  }));
}

function projectReservedCardForViewer(
  reservedCard: ReservedCard,
  ownerId: string,
  viewerPlayerId: string,
  index: number
): ReservedCard {
  const canSeeCard = reservedCard.visibility === 'public' || ownerId === viewerPlayerId;

  return {
    id: canSeeCard ? reservedCard.id : `hidden-reserved-${ownerId}-${index + 1}`,
    level: reservedCard.level,
    visibility: reservedCard.visibility,
    card: canSeeCard && reservedCard.card ? cloneCard(reservedCard.card) : null
  };
}

export function projectGameStateForViewer(state: GameState, viewerPlayerId: string): GameState {
  return {
    ...state,
    players: state.players.map((player) => ({
      ...player,
      tokens: { ...player.tokens },
      bonuses: cloneBonusMap(player.bonuses),
      purchasedCards: player.purchasedCards.map(cloneCard),
      reservedCards: player.reservedCards.map((reservedCard, index) =>
        projectReservedCardForViewer(reservedCard, player.id, viewerPlayerId, index)
      ),
      nobles: player.nobles.map(cloneNoble)
    })),
    decks: {
      level1: createHiddenDeck(1, state.decks.level1.length),
      level2: createHiddenDeck(2, state.decks.level2.length),
      level3: createHiddenDeck(3, state.decks.level3.length)
    },
    visibleCards: {
      level1: state.visibleCards.level1.map(cloneCard),
      level2: state.visibleCards.level2.map(cloneCard),
      level3: state.visibleCards.level3.map(cloneCard)
    },
    nobles: state.nobles.map(cloneNoble),
    winnerIds: [...state.winnerIds],
    log: state.log.map((entry) => {
      const shouldHideReservedDeckCard =
        entry.type === 'reserve_card' &&
        entry.details?.source === 'deck' &&
        entry.playerId !== viewerPlayerId;

      if (!shouldHideReservedDeckCard) {
        return {
          ...entry,
          details: entry.details
            ? {
                ...entry.details,
                colors: entry.details.colors ? [...entry.details.colors] : undefined
              }
            : undefined
        };
      }

      return {
        ...entry,
        summary: `${entry.playerId} reserved a card from the deck.`,
        details: {
          source: 'deck'
        }
      };
    })
  };
}

export function projectRoomForViewer(room: Room, viewerId: string): Room {
  return {
    ...room,
    players: room.players.map((player) => ({ ...player })),
    gameState: room.gameState ? projectGameStateForViewer(room.gameState, viewerId) : null
  };
}

export function startServer(options: StartServerOptions = {}) {
  const app = express();
  const server = http.createServer(app);
  const snapshotPath = options.snapshotPath === null ? null : options.snapshotPath ?? getDefaultSnapshotPath();
  const io = new Server(server, {
    cors: {
      origin: process.env.NODE_ENV === 'development' ? true : 'file://',
      methods: ['GET', 'POST']
    }
  });

  const rooms: Map<string, Room> = new Map();
  const socketToRoomId = new Map<string, string>();
  const socketToPlayerId = new Map<string, string>();
  const playerSessions = new Map<string, PlayerSession>();
  const roomClientIndex = new Map<string, Map<string, string>>();
  const lobbyExpiryTimers = new Map<string, NodeJS.Timeout>();

  server.on('close', () => {
    for (const timer of lobbyExpiryTimers.values()) {
      clearTimeout(timer);
    }
    lobbyExpiryTimers.clear();
    persistSnapshot();
  });

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', rooms: rooms.size });
  });

  function getOrCreateRoomClientIndex(roomId: string): Map<string, string> {
    let index = roomClientIndex.get(roomId);
    if (!index) {
      index = new Map<string, string>();
      roomClientIndex.set(roomId, index);
    }
    return index;
  }

  function buildSnapshot(): HostSnapshot {
    return {
      version: SNAPSHOT_VERSION,
      savedAt: now(),
      rooms: [...rooms.values()].map((room) => JSON.parse(JSON.stringify(room)) as Room),
      sessions: [...playerSessions.entries()].map(([playerId, session]) => ({
        roomId: session.roomId,
        playerId,
        clientId: session.clientId
      }))
    };
  }

  function persistSnapshot() {
    if (!snapshotPath) {
      return;
    }

    try {
      mkdirSync(path.dirname(snapshotPath), { recursive: true });
      const temporaryPath = `${snapshotPath}.tmp`;
      writeFileSync(temporaryPath, JSON.stringify(buildSnapshot(), null, 2), 'utf8');
      renameSync(temporaryPath, snapshotPath);
    } catch (error) {
      if (!options.silent) {
        console.warn('Could not write host snapshot:', error);
      }
    }
  }

  function restoreSnapshot() {
    if (!snapshotPath) {
      return;
    }

    const snapshot = readHostSnapshot(snapshotPath, options.silent);
    if (!snapshot) {
      return;
    }

    for (const loadedRoom of snapshot.rooms) {
      const room = normalizeLoadedRoom(loadedRoom);
      reseatPlayers(room);
      rooms.set(room.id, room);
    }

    for (const session of snapshot.sessions) {
      const room = rooms.get(session.roomId);
      if (!room?.players.some((player) => player.id === session.playerId)) {
        continue;
      }

      playerSessions.set(session.playerId, {
        roomId: session.roomId,
        clientId: session.clientId,
        socketId: null
      });
      getOrCreateRoomClientIndex(session.roomId).set(session.clientId, session.playerId);
    }

    if (!options.silent) {
      console.log(`Restored ${rooms.size} room(s) from host snapshot.`);
    }
  }

  function attachPlayerSocket(roomId: string, playerId: string, clientId: string, socketId: string) {
    const timer = lobbyExpiryTimers.get(playerId);
    if (timer) {
      clearTimeout(timer);
      lobbyExpiryTimers.delete(playerId);
    }

    socketToRoomId.set(socketId, roomId);
    socketToPlayerId.set(socketId, playerId);
    playerSessions.set(playerId, { roomId, clientId, socketId });
    getOrCreateRoomClientIndex(roomId).set(clientId, playerId);
  }

  function clearSocketBindings(socketId: string) {
    const playerId = socketToPlayerId.get(socketId);
    socketToRoomId.delete(socketId);
    socketToPlayerId.delete(socketId);

    if (!playerId) {
      return;
    }

    const session = playerSessions.get(playerId);
    if (session?.socketId === socketId) {
      session.socketId = null;
    }
  }

  function removePlayerSession(roomId: string, playerId: string) {
    const timer = lobbyExpiryTimers.get(playerId);
    if (timer) {
      clearTimeout(timer);
      lobbyExpiryTimers.delete(playerId);
    }

    const session = playerSessions.get(playerId);
    if (session) {
      const roomIndex = roomClientIndex.get(roomId);
      roomIndex?.delete(session.clientId);
      playerSessions.delete(playerId);
    }
  }

  function findPlayerBySocketId(socketId: string): { room: Room; player: LobbyPlayer } | undefined {
    const roomId = socketToRoomId.get(socketId);
    const playerId = socketToPlayerId.get(socketId);
    if (!roomId || !playerId) {
      return undefined;
    }

    const room = rooms.get(roomId);
    if (!room) {
      return undefined;
    }

    const player = room.players.find((candidate) => candidate.id === playerId);
    if (!player) {
      return undefined;
    }

    return { room, player };
  }

  function getViewerPlayerId(socketId: string): string | undefined {
    return socketToPlayerId.get(socketId);
  }

  function getRoomSockets(roomId: string) {
    const socketIds = io.sockets.adapter.rooms.get(roomId);
    if (!socketIds) {
      return [];
    }

    return [...socketIds]
      .map((socketId) => io.sockets.sockets.get(socketId))
      .filter((socket): socket is NonNullable<typeof socket> => !!socket);
  }

  function emitRoomState(roomId: string) {
    const room = rooms.get(roomId);
    if (!room) {
      return;
    }

    for (const memberSocket of getRoomSockets(roomId)) {
      const viewerPlayerId = getViewerPlayerId(memberSocket.id);
      if (!viewerPlayerId) {
        continue;
      }
      memberSocket.emit('room-updated', projectRoomForViewer(room, viewerPlayerId));
    }
  }

  function emitGameState(roomId: string) {
    const room = rooms.get(roomId);
    if (!room?.gameState) {
      return;
    }

    for (const memberSocket of getRoomSockets(roomId)) {
      const viewerPlayerId = getViewerPlayerId(memberSocket.id);
      if (!viewerPlayerId) {
        continue;
      }
      memberSocket.emit('game-state-updated', projectGameStateForViewer(room.gameState, viewerPlayerId));
    }
  }

  function findRoomBySocketId(socketId: string): Room | undefined {
    const roomId = socketToRoomId.get(socketId);
    return roomId ? rooms.get(roomId) : undefined;
  }

  function updateRoomTimestamp(room: Room) {
    room.updatedAt = now();
  }

  function closeRoom(roomId: string, reason: string) {
    const room = rooms.get(roomId);
    if (!room) {
      return;
    }

    const memberSockets = getRoomSockets(roomId);

    for (const player of room.players) {
      removePlayerSession(roomId, player.id);
    }

    rooms.delete(roomId);
    roomClientIndex.delete(roomId);

    for (const memberSocket of memberSockets) {
      clearSocketBindings(memberSocket.id);
      memberSocket.leave(roomId);
      memberSocket.emit('room-closed', { roomId, reason });
    }

    persistSnapshot();
  }

  function cleanupRoomIfEmpty(roomId: string) {
    const room = rooms.get(roomId);
    if (!room) {
      return;
    }

    if (room.players.length > 0) {
      return;
    }

    roomClientIndex.delete(roomId);
    rooms.delete(roomId);
    persistSnapshot();
  }

  function scheduleLobbySessionExpiry(roomId: string, playerId: string) {
    const existing = lobbyExpiryTimers.get(playerId);
    if (existing) {
      clearTimeout(existing);
    }

    const timer = setTimeout(() => {
      lobbyExpiryTimers.delete(playerId);

      const room = rooms.get(roomId);
      if (!room || room.status !== 'open') {
        return;
      }

      const player = room.players.find((candidate) => candidate.id === playerId);
      if (!player || player.connectionState !== 'disconnected') {
        return;
      }

      room.players = room.players.filter((candidate) => candidate.id !== playerId);
      removePlayerSession(roomId, playerId);

      if (room.players.length === 0) {
        cleanupRoomIfEmpty(roomId);
        return;
      }

      if (room.hostId === playerId) {
        closeRoom(roomId, 'The host left the room.');
        return;
      }

      reseatPlayers(room);
      updateRoomTimestamp(room);
      persistSnapshot();
      emitRoomState(roomId);
    }, LOBBY_RECONNECT_WINDOW_MS);

    lobbyExpiryTimers.set(playerId, timer);
  }

  restoreSnapshot();

  io.on('connection', (socket) => {
    if (!options.silent) {
      console.log('Client connected:', socket.id);
    }

    socket.on('create-room', ({ roomName, playerName, clientId }: CreateRoomPayload) => {
      const roomId = generateRoomId();
      const safePlayerName = sanitizePlayerName(playerName);
      const playerId = randomUUID();
      const room: Room = {
        id: roomId,
        name: sanitizeRoomName(roomName, safePlayerName),
        hostId: playerId,
        status: 'open',
        players: [createLobbyPlayer(playerId, safePlayerName, 0, true)],
        gameState: null,
        createdAt: now(),
        updatedAt: now()
      };

      rooms.set(roomId, room);
      attachPlayerSocket(roomId, playerId, clientId, socket.id);
      socket.join(roomId);
      persistSnapshot();
      socket.emit('room-created', roomId);
      socket.emit('room-joined', { room: projectRoomForViewer(room, playerId), player: room.players[0] });
      emitRoomState(roomId);
      if (!options.silent) {
        console.log(`Room created: ${roomId}, host: ${safePlayerName}`);
      }
    });

    socket.on('join-room', (roomId: string, playerInfo: JoinRoomPayload) => {
      const room = rooms.get(roomId);
      if (!room) {
        socket.emit('join-error', 'Room not found.');
        return;
      }

      if (room.status !== 'open') {
        socket.emit('join-error', 'This table is already in a match.');
        return;
      }

      if (room.players.length >= MAX_PLAYERS_PER_ROOM) {
        socket.emit('join-error', 'This table is already full.');
        return;
      }

      const safePlayerName = sanitizePlayerName(playerInfo.name);
      const playerId = randomUUID();
      const player = createLobbyPlayer(playerId, safePlayerName, room.players.length, false);

      room.players.push(player);
      updateRoomTimestamp(room);
      reseatPlayers(room);

      attachPlayerSocket(roomId, playerId, playerInfo.clientId, socket.id);
      socket.join(roomId);
      persistSnapshot();
      socket.emit('room-joined', { room: projectRoomForViewer(room, playerId), player });
      socket.to(roomId).emit('player-joined', player);
      emitRoomState(roomId);
      if (!options.silent) {
        console.log(`${safePlayerName} joined room ${roomId}`);
      }
    });

    socket.on('resume-session', ({ roomId, clientId }: ResumeSessionPayload) => {
      const room = rooms.get(roomId);
      const playerId = roomClientIndex.get(roomId)?.get(clientId);

      if (!room || !playerId) {
        socket.emit('session-resume-failed', 'Saved session could not be restored.');
        return;
      }

      const player = room.players.find((candidate) => candidate.id === playerId);
      if (!player) {
        socket.emit('session-resume-failed', 'Saved player session could not be found.');
        return;
      }

      const previousSession = playerSessions.get(playerId);
      if (previousSession?.socketId && previousSession.socketId !== socket.id) {
        clearSocketBindings(previousSession.socketId);
      }

      attachPlayerSocket(roomId, playerId, clientId, socket.id);
      socket.join(roomId);

      room.players = room.players.map((candidate) =>
        candidate.id === playerId ? { ...candidate, connectionState: 'connected' } : candidate
      );

      if (room.gameState) {
        room.gameState.players = room.gameState.players.map((candidate) =>
          candidate.id === playerId ? { ...candidate, connectionState: 'connected' } : candidate
        );
      }

      updateRoomTimestamp(room);
      persistSnapshot();
      socket.emit('session-resumed', { room: projectRoomForViewer(room, playerId), playerId });
      emitGameState(roomId);
      emitRoomState(roomId);
      if (!options.silent) {
        console.log(`Session resumed for player ${playerId} in room ${roomId}`);
      }
    });

    socket.on('leave-room', (roomId: string) => {
      const room = rooms.get(roomId);
      const playerId = socketToPlayerId.get(socket.id);
      if (!room || !playerId) {
        socket.emit('game-error', 'No active room was found for this connection.');
        return;
      }

      const player = room.players.find((candidate) => candidate.id === playerId);
      if (!player) {
        socket.emit('game-error', 'Player session was not found for this room.');
        return;
      }

      if (player.isHost) {
        closeRoom(room.id, 'The host closed the room.');
        return;
      }

      if (room.status === 'in_game') {
        socket.emit('game-error', 'Leaving an active match is not implemented yet.');
        return;
      }

      room.players = room.players.filter((candidate) => candidate.id !== playerId);
      removePlayerSession(room.id, playerId);
      clearSocketBindings(socket.id);
      socket.leave(room.id);
      socket.emit('room-left', { roomId: room.id });

      if (room.players.length === 0) {
        cleanupRoomIfEmpty(room.id);
        return;
      }

      reseatPlayers(room);
      updateRoomTimestamp(room);
      persistSnapshot();
      emitRoomState(room.id);
    });

    socket.on('close-room', (roomId: string) => {
      const room = rooms.get(roomId);
      const playerId = socketToPlayerId.get(socket.id);
      if (!room || !playerId) {
        socket.emit('game-error', 'No active room was found for this connection.');
        return;
      }

      const player = room.players.find((candidate) => candidate.id === playerId);
      if (!player?.isHost) {
        socket.emit('game-error', 'Only the host can close the room.');
        return;
      }

      closeRoom(room.id, 'The host closed the room.');
    });

    socket.on('start-game', (roomId: string) => {
      const room = rooms.get(roomId);
      if (!room) {
        socket.emit('game-error', 'Room not found.');
        return;
      }

      const playerId = socketToPlayerId.get(socket.id);
      const player = room.players.find((candidate) => candidate.id === playerId);
      if (!player || !player.isHost) {
        socket.emit('game-error', 'Only the host can start the match.');
        return;
      }

      if (room.players.some((candidate) => candidate.connectionState !== 'connected')) {
        socket.emit('game-error', 'All lobby players must be connected before the host can start the match.');
        return;
      }

      if (!canStartGame(room)) {
        socket.emit(
          'game-error',
          `Splendor requires ${MIN_PLAYERS_PER_ROOM} to ${MAX_PLAYERS_PER_ROOM} players.`
        );
        return;
      }

      room.gameState = initializeGame(room);
      room.status = 'in_game';
      updateRoomTimestamp(room);
      persistSnapshot();

      for (const memberSocket of getRoomSockets(roomId)) {
        const viewerPlayerId = getViewerPlayerId(memberSocket.id);
        if (!viewerPlayerId) {
          continue;
        }
        memberSocket.emit(
          'game-started',
          room.gameState ? projectGameStateForViewer(room.gameState, viewerPlayerId) : null
        );
      }
      emitGameState(roomId);
      emitRoomState(roomId);
      if (!options.silent) {
        console.log(`Match started in room ${roomId}`);
      }
    });

    socket.on('game-action', (roomId: string, action: GameAction) => {
      const room = rooms.get(roomId);
      if (!room || !room.gameState) {
        socket.emit('game-error', 'No active match was found for that room.');
        return;
      }

      try {
        const playerId = socketToPlayerId.get(socket.id);
        if (!playerId) {
          socket.emit('game-error', 'Player session was not found for this connection.');
          return;
        }

        applyGameAction(room.gameState, playerId, action);

        if (room.gameState.phase === 'finished') {
          room.status = 'closed';
        }

        updateRoomTimestamp(room);
        persistSnapshot();
        emitGameState(roomId);
        emitRoomState(roomId);
      } catch (error) {
        const message =
          error instanceof GameRuleError ? error.message : 'The server could not apply that move.';
        socket.emit('game-error', message);
      }
    });

    socket.on('disconnect', () => {
      const room = findRoomBySocketId(socket.id);
      const playerId = socketToPlayerId.get(socket.id);
      if (!options.silent) {
        console.log('Client disconnected:', socket.id);
      }

      if (!room) {
        clearSocketBindings(socket.id);
        return;
      }

      if (room.status === 'open') {
        if (playerId) {
          room.players = room.players.map((player) =>
            player.id === playerId ? { ...player, connectionState: 'disconnected' } : player
          );
          scheduleLobbySessionExpiry(room.id, playerId);
        }
        clearSocketBindings(socket.id);
      } else {
        clearSocketBindings(socket.id);
        room.players = room.players.map((player) =>
          player.id === playerId ? { ...player, connectionState: 'disconnected' } : player
        );

        if (room.gameState) {
          room.gameState.players = room.gameState.players.map((player) =>
            player.id === playerId ? { ...player, connectionState: 'disconnected' } : player
          );
        }
      }

      updateRoomTimestamp(room);
      persistSnapshot();
      emitRoomState(room.id);
    });
  });

  const PORT = options.port ?? process.env.PORT ?? 3001;
  server.listen(PORT, () => {
    const address = server.address();
    const resolvedPort = typeof address === 'object' && address ? address.port : PORT;
    if (!options.silent) {
      console.log(`Game server listening at http://localhost:${resolvedPort}`);
    }
  });

  return server;
}

function generateRoomId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

if (require.main === module) {
  startServer();
}
