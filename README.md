# iPod

An iPod-style web UI that controls the macOS **Music** app. The frontend renders a click-wheel interface; an Express bridge translates HTTP requests into AppleScript commands against `Music.app`.

## Requirements

- macOS (the bridge depends on AppleScript + Music.app)
- Music.app set up with a library
- Node.js 20+
- On first request, macOS will prompt to allow the bridge to control Music — accept it (System Settings → Privacy & Security → Automation).

## Getting started

```bash
npm install
npm run dev
```

This starts:

- **Web** (Vite) on http://localhost:5173
- **Bridge** (Express) on http://localhost:3001

Vite proxies `/api/*` to the bridge, so the frontend just calls `/api/...`.

## Scripts

| Script               | What it does                        |
| -------------------- | ----------------------------------- |
| `npm run dev`        | Run web + bridge concurrently       |
| `npm run dev:web`    | Vite only                           |
| `npm run dev:bridge` | Bridge only (tsx watch)             |
| `npm run build`      | Type-check and build the web bundle |
| `npm run preview`    | Preview the production build        |
| `npm run lint`       | Run ESLint                          |

## Architecture

```
src/                  React 19 + Tailwind v4 frontend
  ipod/               ClickWheel, MenuList, NowPlaying
  hooks/              useWheel
  state/api.ts        Bridge API client
server/               Express bridge
  index.ts            App entry, mounts routes on :3001
  applescript.ts      runScript / parseTsv / escapeAS helpers
  cache.ts            Tiny TTL memo cache
  routes/             library | player | artwork
```

Library reads are cached in-memory for 60 seconds to avoid hammering AppleScript.

## API reference

Base URL: `http://localhost:3001`

All responses are JSON unless noted. Errors return `500 { error: string }`.

### Library — `/api/library`

| Method | Path                     | Response                                                  |
| ------ | ------------------------ | --------------------------------------------------------- |
| GET    | `/playlists`             | `[{ id, name, kind: "user" \| "smart", count }]`          |
| GET    | `/playlists/:pid/tracks` | `[{ id, name, artist, album, duration }]`                 |
| GET    | `/songs?offset=&limit=`  | `{ total, items: [Track] }` — `limit` 1–500 (default 200) |
| GET    | `/artists`               | `[{ name, count }]`                                       |
| GET    | `/artists/:name/albums`  | `[{ name, artist }]`                                      |
| GET    | `/albums`                | `[{ name, artist }]`                                      |
| GET    | `/albums/:name/tracks`   | `[Track]`                                                 |
| GET    | `/genres`                | `[{ name, count }]`                                       |
| GET    | `/genres/:name/tracks`   | `[Track]`                                                 |

`Track` = `{ id: number, name, artist, album, genre, duration: number /* seconds */ }`. `:pid` is a Music persistent ID; `id` is the database ID.

### Player — `/api/player`

| Method | Path         | Body                         | Notes                                                                                                           |
| ------ | ------------ | ---------------------------- | --------------------------------------------------------------------------------------------------------------- |
| GET    | `/state`     | —                            | `{ state, name, artist, album, duration, position, id }` — `state` is `"playing" \| "paused" \| "stopped"` etc. |
| POST   | `/play`      | `{ trackId? , playlistId? }` | Omit both to resume. `trackId` = database ID, `playlistId` = persistent ID                                      |
| POST   | `/pause`     | —                            |                                                                                                                 |
| POST   | `/playpause` | —                            | Toggle                                                                                                          |
| POST   | `/next`      | —                            |                                                                                                                 |
| POST   | `/previous`  | —                            |                                                                                                                 |
| POST   | `/seek`      | `{ position }`               | Seconds into the current track                                                                                  |
| POST   | `/shuffle`   | —                            | Enables shuffle and plays the library                                                                           |

Mutating endpoints respond with `{ ok: true }`.

### Artwork — `/api/artwork`

| Method | Path   | Response                                                                                              |
| ------ | ------ | ----------------------------------------------------------------------------------------------------- |
| GET    | `/:id` | Image bytes (`image/jpeg` or `image/png`). `404` if no artwork. Cached for 1 day via `Cache-Control`. |

`:id` is a track database ID.

## Troubleshooting

- **Empty results / silent failures**: macOS may have blocked Automation. Open System Settings → Privacy & Security → Automation, find the terminal/Node entry, and enable "Music".
- **Stale data**: library responses are cached for 60s. Restart `npm run dev:bridge` to clear.
- **Bridge port conflict**: set `PORT=3002 npm run dev:bridge` (and update the Vite proxy in `vite.config.ts` to match).
