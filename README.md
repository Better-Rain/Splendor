
```
splendor-electron
├─ assets
├─ database
├─ electron-builder.json
├─ index.html
├─ package-lock.json
├─ package.json
├─ README.md
├─ src
│  ├─ App.css
│  ├─ App.tsx
│  ├─ index.css
│  ├─ index.tsx
│  ├─ main
│  │  ├─ gameLogic.ts
│  │  ├─ main.ts
│  │  ├─ preload.ts
│  │  ├─ server.ts
│  │  └─ verifySplendorData.ts
│  └─ shared
├─ tsconfig.json
├─ tsconfig.main.json
├─ tsconfig.renderer.json
└─ vite.config.ts

```

## Development

Start the LAN host, Vite renderer, and Electron shell:

```powershell
npm run dev
```

When `npm run dev` starts, it prints the LAN URLs that phones should use. You can print them again at any time:

```powershell
npm run dev:lan-info
```

On this machine the phone should open the `Phone page` URL, not `localhost`. `localhost` on a phone means the phone itself, not the host computer.

The dev command now clears stale project-owned listeners on ports `3000` and `3001` before starting. If startup still reports a port conflict, inspect the listeners:

```powershell
npm run dev:check-ports
```

If the listeners belong to this project, clear them:

```powershell
npm run dev:reset
```

Use `npm run dev:force-reset` only when you are sure the processes on ports `3000` and `3001` can be stopped.

For phone testing, the common failure cases are:

- The phone is using cellular data, a guest Wi-Fi, or a different subnet.
- The router has AP isolation/client isolation enabled.
- Windows Firewall blocks inbound Node.js connections on the current network profile.
- The URL uses `localhost` instead of the host computer LAN IP.

In development, the Socket.IO host server is started by `npm run start:server`. The Electron shell does not start a second embedded server, and the server watcher ignores local host snapshots, so `npm run dev` should not produce a `3001 EADDRINUSE` error. Packaged Electron builds still start their own embedded host server.

The Socket.IO server accepts `file://`, `localhost`, and private LAN origins. If the browser console reports an `Access-Control-Allow-Origin: file://` mismatch, stop the stale process on `3001` with `npm run dev:reset` and restart `npm run dev`.
