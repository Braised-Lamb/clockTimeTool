# System Time Display & Sync Tool

[中文说明 (Chinese)](./README.md)

An Electron + Vue3 desktop utility providing:

1. Large digital system clock (second precision, second-boundary alignment, drift mitigation)
2. One-click sync with a chosen NTP server (Windows w32tm, requires elevation)
3. Custom & history server list (MRU ordering, up to 10 entries)
4. Persistent settings: selected server + font size
5. Always-on-top toggle (📍/📌) with persistence
6. Authoritative time fetched from main process for stable, low-drift updates

## Feature Overview

| Feature             | Description                                                  |
| ------------------- | ------------------------------------------------------------ |
| Time display        | 24h HH:MM:SS with precise second boundary refresh            |
| Sync time           | 🔄 button: runs w32tm /resync /force using configured server |
| Server management   | ⚙️ modal: add / pick / remove, MRU ordering                  |
| History persistence | server-history.json + localStorage for current selection     |
| Font size           | A- / A+ (2 ~ 30 vw) stored in localStorage                   |
| Always-on-top       | 📍=off / 📌=on, persisted and applied on startup             |
| Authoritative time  | ipcMain.handle('get-current-time') central source            |
| Drift handling      | Detect large jumps & force earlier refresh when needed       |

## Requirements

- Windows (w32tm dependency for syncing)
- Node.js >= 20.19.0
- Admin rights (UAC) to adjust system time

## Install & Run

Initial install:

```powershell
npm install
```

Frontend only (browser preview, no Electron IPC/time sync):

```powershell
npm run dev
```

Combined dev (Vite + Electron auto):

```powershell
npm run start:dev
```

Run built app:

```powershell
npm run build
npm run start
```

Package distributable:

```powershell
npm run dist
```

Build then launch immediately:

```powershell
npm run build-and-start
```

## Sync Flow

When 🔄 is clicked:

1. Main creates temp PowerShell script:
   - Start-Service w32time
   - w32tm /config /manualpeerlist:"\<server\>" /syncfromflags:manual /update
   - w32tm /resync /force
2. Elevated run (Start-Process -Verb RunAs)
3. On success renderer forces immediate time refresh

If UAC cancelled -> message: Operation cancelled by user

## Time Source & Refresh Strategy

- Renderer queries main `get-current-time` each tick
- Next delay = 1000 - (now % 1000) for boundary alignment
- Large jump (|drift - 1000| > 1000) or tab visibility -> fast refresh

## Always On Top

- Toggle button 📍/📌 calls BrowserWindow.setAlwaysOnTop
- Persisted in localStorage + synced via IPC on launch

## Key Files

| File                    | Purpose                                                  |
| ----------------------- | -------------------------------------------------------- |
| main.cjs                | Main process & IPC setup                                 |
| preload.js              | Secure bridge: syncTime / getCurrentTime / history / pin |
| src/App.vue             | UI + logic                                               |
| src/types/electron.d.ts | Type declarations                                        |
| public/clock.png        | App icon                                                 |

## FAQ

1. Sync button does nothing? Run app as Administrator (UAC elevation required) or policy blocked.
2. Always-on-top not working? Fullscreen apps can cover it; exit fullscreen.
3. Add custom NTP pools? Yes, simply add them (e.g., pool.ntp.org, time.cloudflare.com).

## Known Issues

- Uncertain delay on first refresh after large manual system time change.

## Possible Future Enhancements

- Multi-server polling & averaging
- Display estimated offset measurements
- Tray icon & context menu
- Transparent / fullscreen modes

## Script Quick Reference

| Command                 | Description                          |
| ----------------------- | ------------------------------------ |
| npm run dev             | Start Vite dev server only           |
| npm run start:dev       | Start Vite + Electron (hot reload)   |
| npm run build           | Build frontend assets to dist/       |
| npm run start           | Launch Electron with built files     |
| npm run build-and-start | Build then launch Electron           |
| npm run dist            | Build & package via electron-builder |

---
