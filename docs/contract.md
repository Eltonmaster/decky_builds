# Decky Builds: frontend ↔ backend contract (v1)

This file is the agreement between the frontend session and the backend session so both can be built at the same time. Change it only by agreement between the two; whoever changes it notes the change at the bottom.

Reference material, all in `/mnt/project-files/design/`:
- `decky-builds-mockup.html`: the approved UI mockup (draft 2), also at https://claude.ai/artifact/8jrHDDfCgpudTuFGpYp4YN
- `example-guides/*.json`: three valid guide files in the v1 format

## Repository layout and ownership

Based on the official `decky-plugin-template` (pnpm, rollup, `@decky/ui`, `@decky/api`).

| Path | Owner |
|---|---|
| `src/**`, `package.json`, `rollup.config.js`, `tsconfig.json` | Frontend |
| `main.py`, `py_modules/**`, `backend/**`, `tests/**` (Python tests) | Backend |
| `defaults/upload/` (the browser upload page served by the file server) | Backend |
| `plugin.json`, `README.md`, `docs/contract.md` (copy of this file) | Shared, edit with care |
| `docs/guide-format.md` and `docs/schema/guide-1.schema.json` | Backend writes, frontend reads |

## Product decisions (from Felix)

- The upload server never starts on its own. It runs only after the user turns on "Accept file uploads" in the Quick Access panel.
- Guides attach to games by Steam `appid`. The library lists every installed game, ordered: running game first, then games with guides, then the rest. There is no filter toggle.
- One section per page in the viewer. L1/R1 change section; down at the end of a section moves into the next one.
- Upload safety: off by default, 6-digit pairing code (new each start), auto-stop after 15 min by default (15/30/60/never), `.json` only, 1 MB max.
- No images in v1.
- Rename (display title only) and delete are possible on the Deck. Content editing is not.
- The running game's guides are highlighted at the top of the Quick Access panel with focus on them, and reopen at the last section read.

## Guide format v1

Exactly as in `example-guides/`. Summary:

```
{ "format": "decky-builds.guide", "version": 1,
  "id": "kebab-slug", "title": str, "game": { "appid": int, "name": str },
  "author"?: str, "updated"?: "YYYY-MM-DD", "tags"?: [str], "summary"?: str,
  "sections": [ { "id": str, "title": str, "blocks": [Block] } ] }
```

Blocks (`type` field):
- `text` `{text: Rich}`
- `heading` `{text: Rich}`
- `list` `{style: "bullet"|"number", items: [Rich]}`
- `checklist` `{id: str, items: [{id: str, text: Rich}]}`
- `table` `{caption?: str, columns: [{label: str, align?: "left"|"right"|"center"}], rows: [[str|number|Rich]], stickyFirstColumn?: bool}`
- `stats` `{items: [{label: str, value: str}]}`
- `callout` `{tone: "tip"|"warning"|"note", title?: str, text: Rich}`

`Rich` = string | span | array of strings and spans. Spans: `{"b": str}`, `{"i": str}`, `{"hl": str}`, `{"btn": "A"|"B"|"X"|"Y"|"L1"|"R1"|"L2"|"R2"|"L4"|"R4"|"L5"|"R5"|"START"|"SELECT"|"DPAD"}`.

Validation (backend, at upload) rejects with path-based messages such as `sections[1].blocks[0] (table): row 4 has 3 cells, but the table has 4 columns.` Rules: format and version match; `id` matches `^[a-z0-9][a-z0-9-]{0,63}$`; `title` non-empty; `game.appid` positive int; at least one section; section ids unique; unknown block types rejected; table rows match column count; checklist ids unique within the guide (key is `checklistId:itemId`); spans valid. Unknown top-level fields are ignored (forward compatible).

Uploading a guide whose `id` already exists replaces the file and keeps progress.

## Backend API (Python `Plugin` methods, called with `callable()` from `@decky/api`)

All times are Unix seconds. Errors raise an exception with a human-readable message; the frontend shows it in a toast.

```ts
type ServerStatus = { running: boolean; url: string | null; port: number | null;
  pairing_code: string | null; auto_stop_minutes: 15 | 30 | 60 | 0; stops_at: number | null };
type Game = { appid: number; name: string };
type GuideMeta = { id: string; title: string; appid: number; game_name: string; author: string | null;
  updated: string | null; tags: string[]; summary: string | null; section_count: number; received_at: number };
type Upload = { file: string; received_at: number; ok: boolean; guide_id: string | null; error: string | null };
type Progress = { checks: Record<string, boolean>; last_section: number | null };
```

| Method | Args | Returns |
|---|---|---|
| `get_server_status` | – | `ServerStatus` |
| `start_server` | `auto_stop_minutes: number` | `ServerStatus` |
| `stop_server` | – | `ServerStatus` |
| `set_auto_stop` | `minutes: number` | `ServerStatus` (restarts the timer from now) |
| `list_installed_games` | – | `Game[]` sorted by name |
| `list_guides` | – | `GuideMeta[]` |
| `get_guide` | `guide_id: string` | full guide object |
| `rename_guide` | `guide_id: string, title: string` | `GuideMeta` |
| `delete_guide` | `guide_id: string` | `true` (also deletes its progress) |
| `list_uploads` | – | `Upload[]`, newest first, last 20, survives restarts |
| `get_progress` | `guide_id: string` | `Progress` |
| `set_check` | `guide_id: string, key: string, value: boolean` | `Progress` |
| `set_last_section` | `guide_id: string, index: number` | `Progress` |

## Backend events (`decky.emit` in Python, `addEventListener` in the frontend)

| Event | Payload | When |
|---|---|---|
| `server_status` | `ServerStatus` | Server starts, stops, auto-stops, timer changes |
| `upload_received` | `Upload` | Every upload attempt that passed the pairing code (valid or rejected) |
| `guides_changed` | `GuideMeta[]` | Any add, replace, rename or delete |

## File server (backend)

- Starts only from `start_server`; stops on `stop_server`, auto-stop, and plugin `_unload`.
- Binds `0.0.0.0`, port 8787, falling back to the next free port. `url` uses the Deck's LAN IPv4.
- `GET /` serves `defaults/upload/index.html`: a simple page with a pairing-code field and drag-and-drop for one or more `.json` files, showing per-file results.
- `POST /api/upload`: body is the raw JSON file, header `X-Pairing-Code`, header `X-Filename`. Responses: `200 {ok: true, guide_id}`, `422 {ok: false, errors: [{path, message}]}`, `401` wrong code, `413` over 1 MB, `429` after 5 wrong codes in a minute.
- Use what Decky's Python provides (check whether `aiohttp` is importable in the plugin process; otherwise stdlib `asyncio`). No extra dependencies unless bundled in `py_modules`.

## Storage (backend)

- Guides: `{DECKY_PLUGIN_RUNTIME_DIR}/guides/{id}.json`
- Progress: `{DECKY_PLUGIN_SETTINGS_DIR}/progress.json`
- Upload history and auto-stop preference: `{DECKY_PLUGIN_SETTINGS_DIR}/state.json`
- Write files atomically (temp file + rename).

## Installed games (backend)

Read `{DECKY_USER_HOME}/.local/share/Steam/steamapps/libraryfolders.vdf`, then each library's `steamapps/appmanifest_*.acf` for `appid` and `name`. Skip tools: Proton*, Steam Linux Runtime*, Steamworks Common Redistributables (appid 228980). Non-Steam shortcuts are out of scope for v1.

## Frontend responsibilities

- Quick Access panel: Now playing card (from `Router.MainRunningApp`, matched by appid), uploads toggle, auto-stop dropdown, open library button, recent uploads with expandable errors.
- Full-screen routes via `routerHook.addRoute`: `/decky-builds/library` and `/decky-builds/guide/:id`.
- Library: search, ordered list, expandable games, X on a guide for rename/delete (`showContextMenu`, `ConfirmModal`, `TextField`).
- Viewer: block-by-block focus, table cell mode with sticky header/first column, X sort, checklist ticks, contents panel, L1/R1 section paging, footer labels via `actionDescriptionMap`.
- Toast when a game with a guide starts (`toaster.toast`).
- Ship a mock of the backend API (same signatures, data from `example-guides/`) so the UI can be developed and tested before the backend is ready.

## Change log

- v1, 2026-11-12: initial contract from the approved mockup.
- v1.1, 2026-11-12 (backend, additive only, no frontend change needed): added `POST /api/pair` (header `X-Pairing-Code`; `200 {ok: true}`, `401`, `429`) so the upload page can check the code before sending files. The `200` upload response also carries `replaced: bool`, `title` and `game_name`. Validation details: `blocks`, list/checklist/stats `items`, table `columns` and `rows` must be non-empty; checklist and item ids may not contain `:`; a stats `value` may also be a number. `X-Filename` may be URI-encoded. Backend is in `/mnt/project-files/decky-builds/` (main.py, py_modules/decky_builds/, defaults/upload/, docs/, tests/).
