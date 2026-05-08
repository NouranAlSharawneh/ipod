# `src-tauri/` — Desktop-app shell

This directory wraps the iPod web app into a native macOS desktop application using [Tauri v2](https://tauri.app/). It contains the Rust shell, the window/bundle config, the app icons, and a Bun-compiled sidecar copy of the Express bridge so the packaged `.app` runs with **no system Node/Bun required at runtime**.

The web app continues to run unchanged in the browser via `npm run dev`. The work in this folder only matters when you want the floating-on-the-desktop, no-Dock-icon, transparent-frame experience.

---

## Prerequisites

Install once on your Mac:

| Tool                             | Why                                                              | Install                                                           |
| -------------------------------- | ---------------------------------------------------------------- | ----------------------------------------------------------------- |
| **Rust** (1.77+)                 | Compiles the Tauri shell                                         | `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \| sh` |
| **Bun** (≥1.3)                   | Compiles the Express bridge into a self-contained sidecar binary | `curl -fsSL https://bun.sh/install \| bash`                       |
| **Xcode Command Line Tools**     | Required by `cargo` and Tauri's macOS bundling                   | `xcode-select --install`                                          |
| **Node.js** (≥20) + project deps | Frontend tooling                                                 | `npm install` from the repo root                                  |

Verify:

```bash
rustc --version   # 1.77+
bun --version     # 1.3+
node --version    # 20+
```

`Music.app` must be installed and signed into Apple Music. On first launch, macOS will prompt to grant the app **Automation → Music** access — accept it. If you miss the prompt, enable it manually in **System Settings → Privacy & Security → Automation**.

---

## Run the app locally

### Option A — Hot-reloading dev mode

```bash
npm run tauri:dev
```

This is the development loop:

1. Compiles the bridge into `src-tauri/binaries/ipod-bridge-<triple>` via `scripts/build-bridge.sh`.
2. Starts Vite on port 5173.
3. Compiles the Rust shell in debug mode and launches the desktop window.
4. Spawns the bridge as a child process bound to `127.0.0.1:38421`.

Edit React/CSS files → the window hot-reloads instantly.
Edit Rust files in `src-tauri/src/` → the shell rebuilds and relaunches automatically.
Edit `server/*.ts` → re-run `npm run build:bridge` (the dev shell doesn't watch the bridge by itself), then quit/relaunch.

### Option B — Production build + install

```bash
npm run tauri:build
```

This produces:

- `src-tauri/target/release/bundle/macos/iPod.app`
- `src-tauri/target/release/bundle/dmg/iPod_<version>_aarch64.dmg`

Install:

```bash
rm -rf /Applications/iPod.app
cp -R src-tauri/target/release/bundle/macos/iPod.app /Applications/iPod.app
open /Applications/iPod.app
```

(First launch: right-click the app in Finder → **Open** to bypass Gatekeeper for the unsigned build.)

### One-liner redeploy after edits

```bash
pkill -f "/Applications/iPod.app/Contents" 2>/dev/null; \
  npm run tauri:build && \
  rm -rf /Applications/iPod.app && \
  cp -R src-tauri/target/release/bundle/macos/iPod.app /Applications/iPod.app && \
  open /Applications/iPod.app
```

---

## What lives where

```
src-tauri/
├── tauri.conf.json        # Window config (transparent, frameless, no shadow,
│                          #   skipTaskbar, no decorations, macOSPrivateApi),
│                          #   bundle identifier, sidecar declaration, icon set
├── Cargo.toml             # Rust deps: tauri (tray-icon, image-png,
│                          #   macos-private-api), shell + global-shortcut plugins
├── build.rs               # Tauri build-time codegen (untouched)
├── capabilities/
│   └── default.json       # ACL: lets the webview start window drags
├── src/
│   ├── main.rs            # Thin entry that calls app_lib::run()
│   └── lib.rs             # All the runtime logic — see below
├── icons/                 # App icon set (regenerable: see “Replacing the icon”)
├── binaries/              # Bun-compiled sidecar lives here (gitignored)
└── target/                # Cargo build cache (gitignored, ~3.5GB)
```

### What `src/lib.rs` does

On startup, in this order:

1. Sets `ActivationPolicy::Accessory` → no Dock icon, no ⌘-Tab entry.
2. Spawns the bridge sidecar with `PORT=38421` and pipes its stdout/stderr to the Rust logger.
3. Registers the **⌘⇧I** global shortcut → toggles always-on-top.
4. Builds a menubar tray icon with a menu: **Show / Hide**, **Toggle pin on top**, **Quit iPod**. Left-click = show/hide; right-click = menu.
5. Intercepts the window's close-requested event → hides the window instead of quitting (quit goes through the tray menu).
6. On `RunEvent::Exit`, kills the sidecar so no orphan processes are left.

### What `tauri.conf.json` enables

| Setting                                       | Effect                                                                                                                 |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `decorations: false`                          | No titlebar / traffic-light area — pure iPod silhouette                                                                |
| `transparent: true` + `macOSPrivateApi: true` | True window transparency around the bezel's rounded corners                                                            |
| `alwaysOnTop: false`                          | Default is **not** pinned. Use ⌘⇧I or the tray to pin.                                                                 |
| `resizable: false`                            | Fixed size matching the iPod component (440×700)                                                                       |
| `skipTaskbar: true`                           | Don't appear in the taskbar (not strictly needed on macOS but kept for parity)                                         |
| `shadow: false`                               | macOS-supplied window shadow turned off; the iPod's own CSS shadow handles it (and is removed in `.tauri` mode anyway) |
| `externalBin: ["binaries/ipod-bridge"]`       | Bundles the sidecar binary into `Contents/MacOS/` of the `.app`                                                        |

---

## How the sidecar bridge works

The packaged app does not assume you have Node installed — the entire Express server is compiled into a single Mach-O binary:

```bash
bun build server/index.ts \
  --compile \
  --target bun-darwin-arm64 \
  --outfile src-tauri/binaries/ipod-bridge-aarch64-apple-darwin
```

`scripts/build-bridge.sh` automates this and resolves the right target triple from `rustc -vV`. The resulting binary is ~59 MB (Bun runtime + bundled dependencies) and listens on `127.0.0.1:38421` only.

The frontend (`src/state/api.ts`) detects Tauri at runtime via `window.__TAURI_INTERNALS__` and points all `/api/...` calls to that URL; in the browser dev mode it keeps using relative paths so Vite's proxy still works.

CORS is wide-open on the bridge — safe because it's bound to localhost.

---

## Replacing the icon

The icon set in `icons/` is generated from `scripts/icon-source.png`. Regenerate either:

**A) Edit the emoji** in `scripts/make-icon.swift`, then:

```bash
swift scripts/make-icon.swift scripts/icon-source.png
npx tauri icon scripts/icon-source.png
```

**B) Drop in your own** 1024×1024 PNG:

```bash
npx tauri icon path/to/your.png
```

After regenerating, rebuild the app for the new icon to take effect.

---

## Troubleshooting

- **"Music gets blocked / empty results"** — System Settings → Privacy & Security → Automation → enable Music for `iPod` (and for `osascript` / your terminal in dev mode).
- **"App stays on top of everything forever"** — ⌘⇧I or the tray's _Toggle pin on top_ unsticks it. Default is not pinned.
- **"Bridge port already in use"** — a leftover dev sidecar or another iPod instance is holding `38421`. `pkill -f ipod-bridge` and relaunch.
- **"I can't drag the window"** — drag from the silver bezel ring around the screen and click-wheel only; the screen and click-wheel themselves are intentionally non-draggable so their gestures keep working.
- **"The app won't open — Apple says it's damaged"** — unsigned ad-hoc build. Right-click the app → **Open** the first time, or run `xattr -dr com.apple.quarantine /Applications/iPod.app`.
- **"Bridge binary missing on `tauri:dev`"** — run `npm run build:bridge` once; `npm run tauri:dev` does this automatically but if you ran `tauri dev` directly, you skipped it.
- **Stale build cache** — `cargo clean --manifest-path src-tauri/Cargo.toml` reclaims ~3.5 GB. Next build will be slow (~5–10 min) but reliable.

---

## What's gitignored

- `binaries/ipod-bridge-*` — regenerable from `scripts/build-bridge.sh`
- `target/` — Cargo build cache
- `gen/schemas/` — Tauri-generated capability schemas
