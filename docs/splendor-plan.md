# Splendor Development Plan

## Product Goal

Build a LAN-friendly desktop adaptation of Splendor for 3 to 4 office players, with one player acting as the host. The host runs the authoritative game state locally and other players join over the local network, similar to a lightweight peer-hosted game session.

## Rules Scope

The first shipping target is the base game only.

- 2 to 4 players, with the LAN target optimized for 3 to 4.
- 90 development cards split into three levels.
- 10 noble tiles, revealing player count plus one.
- Token supply follows the official setup:
  - 2 players: 4 tokens per gem color, 5 gold.
  - 3 players: 5 tokens per gem color, 5 gold.
  - 4 players: 7 tokens per gem color, 5 gold.
- A turn allows exactly one action:
  - Take up to 3 different gem colors.
  - Take 2 tokens of one color only if at least 4 were available before taking.
  - Reserve 1 development card and take 1 gold if available.
  - Buy 1 face-up card or 1 reserved card.
- Players can hold at most 10 tokens at end of turn.
- Nobles are checked automatically at end of turn.
- If a player qualifies for multiple nobles at the end of one turn, they choose exactly one noble; the others remain available for future turns.
- End game triggers when a player reaches 15 prestige points at the end of their turn; the round finishes so all players get the same number of turns.

## Architecture Decision

### Keep

- Electron for packaging and local desktop distribution.
- TypeScript across renderer, main process, and shared game logic.
- Socket.IO for LAN room traffic. It is a good fit for room semantics, reconnection, and event-driven state sync.

### Change

- Replace `react-scripts` with Vite in the renderer.
  - Reason: Create React App is deprecated, and Vite offers a faster local feedback loop with a simpler modern toolchain.
- Treat the host as the authoritative server.
  - The host process owns room membership, turn order, rules validation, and end-game checks.
  - Clients only send intents. They do not mutate state locally.
- Drop Postgres from the first playable milestone.
  - For LAN host mode, Postgres adds deployment and failure complexity without helping gameplay.
  - Match state should stay in memory on the host, with optional local persistence later.
- Prefer a local snapshot store only when needed.
  - If we need reconnection recovery or save/resume, use a local embedded database such as SQLite on the host.
  - Postgres only becomes useful again if we later add a central lobby, matchmaking, user accounts, analytics, or cloud saves.

### Process Boundaries

- Electron main process:
  - Window lifecycle.
  - Host process startup and shutdown.
  - Native integrations and secure IPC.
- Node host server:
  - Socket.IO room transport.
  - Authoritative game state.
  - Rules engine.
- Renderer:
  - Lobby UI.
  - Game board UI.
  - Action composition and optimistic affordances only where safe.

## UI Direction

Current UI is too saturated and generic. The target style is:

- Quiet tabletop atmosphere instead of neon gradients.
- Warm felt, brass, parchment, and ink colors.
- Strong information hierarchy:
  - Room status first.
  - Board state second.
  - Player economy and turn affordances third.
- Minimal but purposeful animations for view transitions and key state changes.
- Split dense match content into focused views so players do not need to scan one long page during their turn.
- Mobile-adjacent width handling is still important because Electron windows may be resized.

## Milestones

### Milestone 0: Foundation

- Stabilize TypeScript config.
- Define shared game domain types.
- Define room lifecycle states.
- Replace alert-driven prototype UI with persistent status surfaces.

### Milestone 1: First Playable Vertical Slice

- Accurate base-game setup.
- Host room creation and joining.
- Start game and deal visible market.
- Implement legal action validation for:
  - take 3 different tokens
  - take 2 same-color tokens
  - reserve card
  - buy visible or reserved card
- Enforce token limit, gold usage, discounts, and noble claims.
- End-game trigger and winner resolution.

### Milestone 2: Reliability

- Reconnection handling.
- Host migration policy or explicit host-only room lifetime.
- Local save snapshot for interrupted sessions.
- Better error recovery for stale client state.

### Milestone 3: Product Cleanup

- Migrate renderer from CRA to Vite.
- Replace placeholder card data with the full official base deck.
- Add action log, undo-safe debug tools, and packaged build polish.
- Add automated rules tests.

## Remaining Roadmap

### Gameplay Polish

- Add table-level ready and seating controls before starting a match.

### LAN Reliability

- Keep the current host-authoritative model, but document the explicit host-only room lifetime.
- Add a room recovery panel for restored rooms, including disconnected players and snapshot age.

### Tooling And Packaging

- Keep dev startup resilient against stale local server processes and port conflicts.
- Add a production smoke check for the built Electron renderer.
- Tighten package metadata, icon handling, and installer output naming.

### Test Coverage

- Split the large verification script into focused rules, server, and snapshot checks.
- Add socket-level tests for game actions from the wrong player, disconnected players, and stale room IDs.
- Add renderer smoke tests once the Vite migration is complete.

## Immediate Work Ordered For This Repository

- [x] Write the plan and store it in the repository.
- [x] Clean up the shared game model and room state shape.
- [x] Replace the current flashy lobby shell with a calmer baseline UI.
- [x] Improve room synchronization so the UI can evolve without fragile alert logic.
- [x] Migrate renderer tooling from CRA to Vite.
- [x] Replace placeholder card generation with the complete official base deck.
- [x] Implement core action validation and turn resolution.
- [x] Add tests for setup and token rules.
- [x] Roll back failed rule actions so stale or invalid client intents cannot corrupt host state.
- [x] Persist host room snapshots locally so sessions can resume after the host process restarts.
- [x] Add manual leave-room and host close-room controls.
- [x] Let the active player choose between multiple eligible nobles.
- [x] Add clearer card readability with localized cost badges and affordability hints.
- [x] Add end-of-game summary details: final scores, purchased-card tie breaker, and shared winners.
- [x] Improve in-game player panels with clearer token, bonus, reserve, and noble breakdowns.
- [x] Add clearer action-log presentation with localized action categories and important turn events.
- [x] Add focused in-game view switching with subtle transition animation.
- [x] Add development port cleanup for stale local Vite and host-server processes.
- [x] Separate the development Socket.IO server from the Electron embedded server to avoid duplicate port 3001 listeners.
- [x] Harden Socket.IO LAN CORS handling for `file://`, localhost, and private LAN browser clients.
- [x] Restrict the development server watcher so host snapshot writes do not restart the server and race port `3001`.

## Notes On Card Data

The repository now includes the full base-game development deck and noble tiles in `src/shared/baseSet.ts`. The verification script checks card counts, point distribution, a stable base-set hash, setup rules, core actions, winner tie breakers, multiple-noble choice, invalid-action rollback, hidden information projection, lobby session recovery, room lifecycle controls, and host snapshot recovery.

Official noble clarification: the base rules do not allow taking multiple nobles in a single turn. If several nobles are eligible, the current player chooses one visitor.

## References

- Official Splendor rules PDF: https://cdn.svc.asmodee.net/production-spacecowboys/uploads/2025/10/SCSPL01EN_SPLENDOR_RULES_LIGHT.pdf
- Reference implementation used to cross-check card and noble transcription: https://github.com/caeleel/splendor/blob/master/server/player_and_game.py
- React guidance for new projects: https://react.dev/learn/start-a-new-react-project
- React installation guidance: https://react.dev/learn/installation
- CRA deprecation announcement: https://react.dev/blog/2025/02/14/sunsetting-create-react-app
- Vite guide: https://vite.dev/guide/
- Why Vite: https://vite.dev/guide/why.html
- Electron process model: https://www.electronjs.org/docs/latest/tutorial/process-model
- Electron security checklist: https://www.electronjs.org/docs/latest/tutorial/security
- Socket.IO rooms: https://socket.io/docs/v4/rooms/
