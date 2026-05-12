import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import { MAX_PLAYERS_PER_ROOM, MIN_PLAYERS_PER_ROOM } from '../shared/constants';
import { BonusMap, Card, GameAction, GameState, LobbyPlayer, Noble, ReservedCard, Room } from '../shared/types';
import { applyGameAction, canStartGame, GameRuleError, initializeGame } from './gameLogic';

interface CreateRoomPayload {
  roomName: string;
  playerName: string;
}

interface JoinRoomPayload {
  name: string;
}

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

function createLobbyPlayer(socketId: string, name: string, seat: number, isHost: boolean): LobbyPlayer {
  return {
    id: socketId,
    name,
    isHost,
    seat,
    joinedAt: now(),
    connectionState: 'connected'
  };
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
  viewerId: string,
  index: number
): ReservedCard {
  const canSeeCard = reservedCard.visibility === 'public' || ownerId === viewerId;

  return {
    id: canSeeCard ? reservedCard.id : `hidden-reserved-${ownerId}-${index + 1}`,
    level: reservedCard.level,
    visibility: reservedCard.visibility,
    card: canSeeCard && reservedCard.card ? cloneCard(reservedCard.card) : null
  };
}

function projectGameStateForViewer(state: GameState, viewerId: string): GameState {
  return {
    ...state,
    players: state.players.map((player) => ({
      ...player,
      tokens: { ...player.tokens },
      bonuses: cloneBonusMap(player.bonuses),
      purchasedCards: player.purchasedCards.map(cloneCard),
      reservedCards: player.reservedCards.map((reservedCard, index) =>
        projectReservedCardForViewer(reservedCard, player.id, viewerId, index)
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
        entry.playerId !== viewerId;

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

function projectRoomForViewer(room: Room, viewerId: string): Room {
  return {
    ...room,
    players: room.players.map((player) => ({ ...player })),
    gameState: room.gameState ? projectGameStateForViewer(room.gameState, viewerId) : null
  };
}

export function startServer() {
  const app = express();
  const server = http.createServer(app);
  const io = new Server(server, {
    cors: {
      origin: process.env.NODE_ENV === 'development' ? true : 'file://',
      methods: ['GET', 'POST']
    }
  });

  const rooms: Map<string, Room> = new Map();

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', rooms: rooms.size });
  });

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
      memberSocket.emit('room-updated', projectRoomForViewer(room, memberSocket.id));
    }
  }

  function emitGameState(roomId: string) {
    const room = rooms.get(roomId);
    if (!room?.gameState) {
      return;
    }

    for (const memberSocket of getRoomSockets(roomId)) {
      memberSocket.emit('game-state-updated', projectGameStateForViewer(room.gameState, memberSocket.id));
    }
  }

  function findRoomBySocketId(socketId: string): Room | undefined {
    for (const room of rooms.values()) {
      if (room.players.some((player) => player.id === socketId)) {
        return room;
      }
    }

    return undefined;
  }

  function updateRoomTimestamp(room: Room) {
    room.updatedAt = now();
  }

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    socket.on('create-room', ({ roomName, playerName }: CreateRoomPayload) => {
      const roomId = generateRoomId();
      const safePlayerName = sanitizePlayerName(playerName);
      const room: Room = {
        id: roomId,
        name: sanitizeRoomName(roomName, safePlayerName),
        hostId: socket.id,
        status: 'open',
        players: [createLobbyPlayer(socket.id, safePlayerName, 0, true)],
        gameState: null,
        createdAt: now(),
        updatedAt: now()
      };

      rooms.set(roomId, room);
      socket.join(roomId);
      socket.emit('room-created', roomId);
      socket.emit('room-joined', { room: projectRoomForViewer(room, socket.id), player: room.players[0] });
      emitRoomState(roomId);
      console.log(`Room created: ${roomId}, host: ${safePlayerName}`);
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
      const player = createLobbyPlayer(socket.id, safePlayerName, room.players.length, false);

      room.players.push(player);
      updateRoomTimestamp(room);
      reseatPlayers(room);

      socket.join(roomId);
      socket.emit('room-joined', { room: projectRoomForViewer(room, socket.id), player });
      socket.to(roomId).emit('player-joined', player);
      emitRoomState(roomId);
      console.log(`${safePlayerName} joined room ${roomId}`);
    });

    socket.on('start-game', (roomId: string) => {
      const room = rooms.get(roomId);
      if (!room) {
        socket.emit('game-error', 'Room not found.');
        return;
      }

      const player = room.players.find((candidate) => candidate.id === socket.id);
      if (!player || !player.isHost) {
        socket.emit('game-error', 'Only the host can start the match.');
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

      for (const memberSocket of getRoomSockets(roomId)) {
        memberSocket.emit(
          'game-started',
          room.gameState ? projectGameStateForViewer(room.gameState, memberSocket.id) : null
        );
      }
      emitGameState(roomId);
      emitRoomState(roomId);
      console.log(`Match started in room ${roomId}`);
    });

    socket.on('game-action', (roomId: string, action: GameAction) => {
      const room = rooms.get(roomId);
      if (!room || !room.gameState) {
        socket.emit('game-error', 'No active match was found for that room.');
        return;
      }

      try {
        applyGameAction(room.gameState, socket.id, action);

        if (room.gameState.phase === 'finished') {
          room.status = 'closed';
        }

        updateRoomTimestamp(room);
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
      console.log('Client disconnected:', socket.id);

      if (!room) {
        return;
      }

      if (room.status === 'open') {
        room.players = room.players.filter((player) => player.id !== socket.id);

        if (room.players.length === 0) {
          rooms.delete(room.id);
          return;
        }

        const hostStillPresent = room.players.some((player) => player.id === room.hostId);
        if (!hostStillPresent) {
          room.hostId = room.players[0].id;
        }

        reseatPlayers(room);
      } else {
        room.players = room.players.map((player) =>
          player.id === socket.id ? { ...player, connectionState: 'disconnected' } : player
        );

        if (room.gameState) {
          room.gameState.players = room.gameState.players.map((player) =>
            player.id === socket.id ? { ...player, connectionState: 'disconnected' } : player
          );
        }
      }

      updateRoomTimestamp(room);
      emitRoomState(room.id);
    });
  });

  const PORT = process.env.PORT || 3001;
  server.listen(PORT, () => {
    console.log(`Game server listening at http://localhost:${PORT}`);
  });

  return server;
}

function generateRoomId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}
