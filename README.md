# iPod

![iPod screenshot](public/screenshot.png)

A recreation of the classic iPod that controls your real Apple Music library on macOS. The frontend renders a click-wheel UI; an Express bridge translates HTTP requests into AppleScript commands against `Music.app`.

It runs in two modes:

- **Browser mode** — `npm run dev` starts Vite + the bridge; open `http://localhost:5173`.
- **Desktop-app mode** — a packaged Tauri build that runs as a transparent, frameless macOS widget you can drag onto your desktop. No browser, no Dock icon, no ⌘-Tab clutter — only a menubar tray icon.

Browsers can't talk to native apps directly, so this only works on a Mac with `Music.app` open and signed into your Apple Music account. The trade-off versus a public web app: no Apple Developer fee, full library access, real album art, real playback.

## Requirements

- macOS with `Music.app` set up and signed in
- Node.js 20+
- For the desktop-app build: [Rust toolchain](https://rustup.rs/) and [Bun](https://bun.sh/) (used to compile the bridge into a self-contained sidecar binary)
- On first request, macOS prompts to allow the bridge to control Music — accept it (System Settings → Privacy & Security → Automation).

## Getting started

### Browser mode

```bash
npm install
npm run dev
```

This starts:

- **Web** (Vite) on http://localhost:5173
- **Bridge** (Express) on http://localhost:3001

Vite proxies `/api/*` to the bridge, so the frontend just calls `/api/...`.

### Desktop-app mode

```bash
npm run tauri:dev      # hot-reloading desktop app
npm run tauri:build    # produces iPod.app + a .dmg
```

`tauri:build` writes `src-tauri/target/release/bundle/macos/iPod.app`. Drag it to `/Applications`, right-click → Open the first time (the build is unsigned and ad-hoc), and grant Automation access to Music.

The packaged app:

- Has **no Dock icon and no ⌘-Tab entry** — it's an accessory-policy app, accessible only via its menubar tray (Show / Hide, Toggle pin on top, Quit).
- Starts as a **normal floating window**. ⌘⇧I (or the tray's "Toggle pin on top") lifts it to always-on-top when you want a glanceable widget; press it again to drop back to normal.
- Is **draggable by the silver bezel** around the screen and click wheel.
- Has a **transparent window** so only the iPod is visible — no surrounding chrome.
- Embeds the Express bridge as a **self-contained sidecar binary** (compiled by `bun build --compile`), bound to `127.0.0.1:38421`. No external Node runtime needed at runtime.

## Scripts

| Script                | What it does                                                |
| --------------------- | ----------------------------------------------------------- |
| `npm run dev`         | Browser mode: web + bridge concurrently                     |
| `npm run dev:web`     | Vite only                                                   |
| `npm run dev:bridge`  | Bridge only (`tsx watch`)                                   |
| `npm run build`       | Type-check and build the web bundle                         |
| `npm run build:bridge`| Compile the bridge into a Tauri sidecar binary (Bun)        |
| `npm run tauri:dev`   | Build the bridge sidecar, then run the desktop app          |
| `npm run tauri:build` | Build the bridge sidecar, then produce `iPod.app` + `.dmg`  |
| `npm run preview`     | Preview the production web build                            |
| `npm run lint`        | Run ESLint                                                  |

## UI

- **Click wheel** — drag around the wheel to scroll the menu (authentic touch-wheel feel), plus the four labelled regions (`MENU`, `⏮`, `⏭`, `⏯`) and the centre select button are clickable.
- **Keyboard** — `↑`/`↓` scroll, `Enter` select, `Esc`/`Backspace` go back, `Space` play/pause, `←`/`→` previous/next track.
- **Title bar** — play/pause indicator on the left, view title in the centre, real Mac battery indicator on the right (turns amber under 30%, red under 15%, shows a charging bolt when on AC).
- **Now Playing** — album art, title/artist/album, position/remaining, progress bar.
- **Next/Previous** — traverse the playlist queue you started from (frontend tracks the queue; `next track` in `Music.app` is unreliable for playlist context).
- **Desktop-app extras** — drag the iPod by its silver bezel; ⌘⇧I toggles always-on-top; the menubar tray icon shows/hides the window and offers a Quit action.

## Architecture

```
src/                       React 19 + Tailwind v4 frontend
  App.tsx                  Thin orchestration: nav reducer + effects wiring; drops the centering wrapper in Tauri mode
  main.tsx                 Adds `tauri` class to <html> when running inside the desktop app
  ipod/
    ClickWheel.tsx         SVG wheel with drag-to-scroll + clickable regions
    Screen.tsx             Title bar + body switch (Menu vs NowPlaying)
    MenuList.tsx           Scrollable list with selection highlight
    NowPlaying.tsx         Album art, track info, progress bar
    BatteryIcon.tsx        SVG battery widget
  hooks/
    useWheel.ts            Drag math: angle deltas → scroll ticks
    usePlayer.ts           Polls /api/player/state every 1s
    useBattery.ts          Polls /api/system/battery every 30s
    useQueue.ts            Playback queue + next/prev within playlist
    useNavKeyboard.ts      Keyboard bindings
  state/
    api.ts                 Typed fetch wrappers + simple TTL cache. Routes through `http://127.0.0.1:38421` in Tauri mode, relative `/api/...` paths in the browser.
    nav.ts                 Navigation reducer (push/pop/scroll/set-data)
    loadView.ts            Per-view data loader + title resolver
    types.ts               View, Frame, NavState, NavAction
  index.css                Adds `.tauri` overrides: transparent body, draggable silver bezel, no drop shadow
server/                    Express bridge (also compiled into a Tauri sidecar)
  index.ts                 App entry, mounts routes; binds 127.0.0.1; permissive CORS for the Tauri webview
  applescript.ts           runScript / parseTsv / escapeAS helpers
  cache.ts                 In-memory TTL memo
  routes/
    library.ts             Playlists, artists, albums, songs, genres, tracks
    player.ts              State + transport controls
    artwork.ts             Album art (binary stream); falls back to the iTunes Search API for streamed tracks
    system.ts              Battery (pmset)
src-tauri/                 Tauri v2 desktop-app shell
  tauri.conf.json          Frameless transparent window, sidecar declaration, accessory activation policy
  src/lib.rs               Spawns the bridge sidecar, registers ⌘⇧I global hotkey, builds menubar tray, manages clean shutdown
  binaries/                Bun-compiled bridge binary (gitignored; produced by `npm run build:bridge`)
  icons/                   App icon set (regenerable via `scripts/make-icon.swift` + `npx tauri icon`)
scripts/
  build-bridge.sh          Compiles `server/index.ts` to a target-triple-named Bun binary for Tauri's externalBin
  make-icon.swift          Renders the app icon (🎵 on a black rounded square) using Apple Color Emoji
```

### Identifiers

Tracks and playlists are referenced by **persistent ID** (a stable hex string assigned by `Music.app`). Earlier versions used numeric database IDs; persistent IDs are reliable across `whose` filters for cloud-only Apple Music tracks too.

### Performance notes

- Library reads are cached for 60s in the bridge.
- Bulk property fetches: `<prop> of every track of <source>` runs in a single Apple Event, then values are zipped in AppleScript's native list space — ~10× faster than iterating tracks one by one. This is applied across `allTracks`, `/playlists/:pid/tracks`, artists, and genres. A 500-track playlist loads in ~0.25s cold.
- The frontend caches in-flight `GET`s, so navigating back into a view doesn't refetch.
- Songs are sorted by **date added (most recent first)** in the bridge, computed from `date added of every track` and a locale-safe epoch.

### Album art and streamed tracks

Apple Music tracks streamed from the cloud return `count of artworks = 0` via AppleScript — the data simply isn't exposed locally. To keep Now Playing functional, `/api/artwork/:id` first tries the track's embedded artwork; if that's empty it falls back to the public **iTunes Search API** keyed by the track's artist + album, upgrading the result to a 600×600 JPEG.

### Navigation model

Each entry in the navigation stack is a `Frame` that owns its own `items`, `tracks`, `selected` index, and `loaded` flag. Pushing creates a new empty frame; popping discards the top. The data-load effect fires per view change and dispatches a `set-data` action; the reducer ignores writes whose `viewKey` no longer matches the current top frame, so a stale fetch from a popped view can't bleed into a new one.

React keys for track rows are prefixed with the row index (`${i}-${id}`) because a single playlist can legitimately contain the same track multiple times — without the prefix, React's reconciler leaves orphan DOM nodes when you navigate away.

### Desktop-app internals

The Tauri app launches the Express bridge as a **sidecar child process** at startup and tears it down on exit. The sidecar binary is produced by `bun build server/index.ts --compile` — it includes the Bun runtime so no system Node is required after install. The frontend detects Tauri via `window.__TAURI_INTERNALS__` and:

- Adds a `.tauri` class to `<html>`, which makes the body transparent and turns the silver iPod bezel into a `-webkit-app-region: drag` handle (with `no-drag` opt-outs on the screen and click-wheel so their gestures still work).
- Routes API calls to `http://127.0.0.1:38421` directly instead of using the Vite dev proxy.

The Rust shell (`src-tauri/src/lib.rs`) also: applies `ActivationPolicy::Accessory` to hide the app from Dock/⌘-Tab, registers a global ⌘⇧I shortcut to toggle always-on-top, intercepts the window's close-requested event so the red traffic light *hides* the window instead of quitting (quit goes through the tray menu), and builds a tray icon with Show/Hide, Toggle Pin, and Quit items.

## API reference

Base URL: `http://localhost:3001` (browser mode) or `http://127.0.0.1:38421` (packaged desktop app).

All responses are JSON unless noted. Errors return `500 { error: string }`.

### Library — `/api/library`

| Method | Path                     | Response                                                                |
| ------ | ------------------------ | ----------------------------------------------------------------------- |
| GET    | `/playlists`             | `[{ id, name, kind: "user" \| "smart", count }]`                        |
| GET    | `/playlists/:pid/tracks` | `[{ id, name, artist, album, duration }]`                               |
| GET    | `/songs?offset=&limit=`  | `{ total, items: [Track] }` — `limit` 1–500. Sorted by date added desc. |
| GET    | `/artists`               | `[{ name, count }]`                                                     |
| GET    | `/artists/:name/albums`  | `[{ name, artist }]`                                                    |
| GET    | `/albums`                | `[{ name, artist }]`                                                    |
| GET    | `/albums/:name/tracks`   | `[Track]`                                                               |
| GET    | `/genres`                | `[{ name, count }]`                                                     |
| GET    | `/genres/:name/tracks`   | `[Track]`                                                               |

`Track` = `{ id: string, name, artist, album, genre, duration: number /* seconds */, addedAt: number /* unix seconds */ }`. All `id` and `:pid` values are Music persistent IDs.

### Player — `/api/player`

| Method | Path         | Body                        | Notes                                                                  |
| ------ | ------------ | --------------------------- | ---------------------------------------------------------------------- |
| GET    | `/state`     | —                           | `{ state, name, artist, album, duration, position, id }`               |
| POST   | `/play`      | `{ trackId?, playlistId? }` | Omit both to resume. With both, plays the track within the playlist's source so next/previous follow the playlist order. |
| POST   | `/pause`     | —                           |                                                                        |
| POST   | `/playpause` | —                           | Toggle                                                                 |
| POST   | `/next`      | —                           |                                                                        |
| POST   | `/previous`  | —                           |                                                                        |
| POST   | `/seek`      | `{ position }`              | Seconds into the current track                                         |
| POST   | `/shuffle`   | —                           | Enables shuffle and plays the library                                  |

`state` is one of `"playing" | "paused" | "stopped" | "fast forwarding" | "rewinding"`. Mutating endpoints respond with `{ ok: true }`.

### Artwork — `/api/artwork`

| Method | Path   | Response                                                                                                                                            |
| ------ | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/:id` | Image bytes (`image/jpeg` or `image/png`). `404` if no artwork is available locally **or** via the iTunes Search fallback. Cached 1 day via `Cache-Control`. |

`:id` is a track persistent ID.

### System — `/api/system`

| Method | Path       | Response                                                       |
| ------ | ---------- | -------------------------------------------------------------- |
| GET    | `/battery` | `{ percent: number, charging: boolean }` (via `pmset -g batt`) |

## Troubleshooting

- **Empty results / silent failures**: macOS may have blocked Automation. Open System Settings → Privacy & Security → Automation, find the terminal/Node entry (or `iPod` for the packaged app), and enable "Music".
- **Tracks won't play**: cloud-only Apple Music tracks aren't always resolvable in `library playlist 1` by `whose persistent ID`; the bridge falls back to searching user playlists. If a track still won't play, it may not be in any of your playlists or the library.
- **Album art missing for streamed tracks**: this falls back to iTunes Search; if the artist+album combination doesn't match a record there, art will be unavailable. Local files / matched-cloud files use their embedded artwork directly.
- **Stale data**: library responses are cached for 60s. Restart `npm run dev:bridge` (or relaunch the desktop app) to clear.
- **Bridge port conflict (browser mode)**: set `PORT=3002 npm run dev:bridge` (and update the Vite proxy in `vite.config.ts` to match). The packaged app uses `38421` and is unaffected.
- **Desktop app stays on top of everything**: ⌘⇧I toggles pinning. The default is *not* pinned; if it feels stuck, the hotkey may have been registered when the OS focus was already elsewhere — click the menubar tray's "Toggle pin on top" instead.
- **Desktop app won't drag**: dragging only works on the silver bezel ring around the screen and wheel — the screen and click-wheel themselves intentionally aren't drag handles so their gestures keep working.
