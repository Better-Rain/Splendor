
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

The dev command now clears stale project-owned listeners on ports `3000` and `3001` before starting. If startup still reports a port conflict, inspect the listeners:

```powershell
npm run dev:check-ports
```

If the listeners belong to this project, clear them:

```powershell
npm run dev:reset
```

Use `npm run dev:force-reset` only when you are sure the processes on ports `3000` and `3001` can be stopped.
