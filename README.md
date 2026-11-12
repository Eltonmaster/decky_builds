# Decky Builds

A Decky Loader plugin for game guides and build sheets on the Steam Deck. You write a guide as a JSON file on your PC, send it to the Deck over the local network, and read it with the controller next to the game.

- **Now playing first.** When a game with a guide is running, the Quick Access panel opens with that guide highlighted, so it is Quick Access → Decky Builds → A. Guides reopen at the section you last read, and a toast says a guide is ready when the game starts.
- **Uploads only when you ask.** The upload server is off until you turn on "Accept file uploads". It shows a URL and a 6-digit pairing code, and stops on its own after 15 minutes by default.
- **Library.** Every installed game, searchable by game, guide title and tag. The running game comes first, then games with guides, then the rest. Press X on a guide to rename or delete it.
- **Controller-first viewer.** One section per page. The D-pad moves block by block, L1/R1 change section, Y opens the contents, A ticks checklist items. On a table, A enters cell mode: the header (and optionally the first column) stays pinned, X sorts by the current column, B leaves.

The guide format is described in [docs/guide-format.md](docs/guide-format.md), and the frontend/backend agreement in [docs/contract.md](docs/contract.md).

## Layout

| Path | What |
|---|---|
| `src/` | Frontend (React + TypeScript, `@decky/ui`, `@decky/api`) |
| `src/api/` | Typed wrappers for the backend methods, plus a mock backend |
| `src/viewer/`, `src/library/`, `src/qam/` | Guide viewer, library page, Quick Access panel |
| `dev/preview/` | Browser preview of the UI with Decky stubbed out (keyboard as controller) |
| `main.py`, `py_modules/` | Backend: upload server, installed games, guide storage |
| `defaults/upload/` | The upload page the server serves to your PC's browser |

## Building

```sh
pnpm install
pnpm build          # dist/index.js for the real plugin
pnpm build:mock     # same UI, but backed by an in-memory mock with the example guides
pnpm typecheck
pnpm test           # frontend unit tests (vitest)
python3 -m unittest discover -s tests   # backend tests
```

`./scripts/package.sh` (after `pnpm build`) writes an installable `out/decky-builds-<version>.zip`.

## CI and releases

GitHub Actions (`.github/workflows/ci.yml`) runs on every pull request and push to `main`: type-check, frontend tests, build, and the backend tests on Python 3.11 and 3.13. If those pass it packages the plugin ZIP and attaches it to the run as an artifact (Actions → the run → Artifacts).

To publish a release, bump `version` in `package.json`, merge, then push a matching tag:

```sh
git tag v0.1.0 && git push origin v0.1.0
```

The workflow then creates a GitHub Release for the tag with the ZIP attached. Instead of pushing a tag you can also open Actions → CI → **Run workflow** on `main` and tick **release**; that creates the `v<version>` tag and release from `package.json`'s version. Tags with a hyphen (`v0.2.0-beta.1`) become pre-releases. A tag that does not match `package.json` fails the build.

## Installing on the Deck

1. In Decky (Quick Access → Decky → gear icon) open **General** and turn on **Developer mode**. A **Developer** tab appears.
2. Either download the ZIP onto the Deck (Desktop mode) and use **Developer → Install Plugin from ZIP File**, or copy the ZIP's link from the GitHub Release and use **Install Plugin from URL**.
3. Confirm the install prompt. Decky Builds shows up in the Decky plugin list. Installing a newer ZIP replaces the old version; your guides are kept in Decky's plugin data folder.

## Browser preview

`pnpm preview` bundles the real screens with stand-ins for Steam's components and the mock backend. Serve the folder and open it:

```sh
pnpm preview
python3 -m http.server 8765 -d dev/preview
# open http://localhost:8765/?running=1245620
```

Arrows are the D-pad, Enter is A, Esc is B, X and Y are X and Y, Q and E are L1 and R1. The "Running game" picker simulates launching a game. The preview approximates Steam's focus navigation; the real thing still needs a check on a Deck.
