// Small global store for state that both the Quick Access panel and the
// full-screen routes need. Backend events keep it fresh.
import { useSyncExternalStore } from "react";
import { Router } from "@decky/ui";
import { api, events } from "./api";
import type { Game, GuideMeta, ServerStatus, Upload } from "./types";

export type RunningGame = { appid: number; name: string } | null;

export type State = {
  status: ServerStatus | null;
  guides: GuideMeta[] | null;
  games: Game[] | null;
  uploads: Upload[];
  running: RunningGame;
};

let state: State = { status: null, guides: null, games: null, uploads: [], running: null };
const subscribers = new Set<() => void>();

export function getState(): State {
  return state;
}

export function setState(patch: Partial<State>) {
  state = { ...state, ...patch };
  subscribers.forEach((s) => s());
}

function subscribe(fn: () => void) {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}

export function useStore<T>(select: (s: State) => T): T {
  return useSyncExternalStore(subscribe, () => select(state));
}

export async function refreshGuides() {
  setState({ guides: await api.list_guides() });
}

export async function refreshGames() {
  setState({ games: await api.list_installed_games() });
}

export async function refreshStatus() {
  const [status, uploads] = await Promise.all([api.get_server_status(), api.list_uploads()]);
  setState({ status, uploads });
}

/** Reads the running game from Steam's router (the app in front, if any). */
export function readRunningGame(): RunningGame {
  try {
    const app = Router.MainRunningApp;
    if (!app) return null;
    const appid = Number(app.appid);
    if (!Number.isFinite(appid) || appid <= 0) return null;
    return { appid, name: app.display_name };
  } catch {
    return null;
  }
}

export function refreshRunning() {
  const running = readRunningGame();
  const prev = state.running;
  if (prev?.appid !== running?.appid || prev?.name !== running?.name) setState({ running });
}

/** Subscribes to backend events. Returns a function that unsubscribes. */
export function connectBackendEvents(): () => void {
  const offs = [
    events.on("server_status", (status) => setState({ status })),
    events.on("guides_changed", (guides) => setState({ guides })),
    events.on("upload_received", (upload) => setState({ uploads: [upload, ...state.uploads].slice(0, 20) })),
  ];
  return () => offs.forEach((off) => off());
}

export function guidesForApp(guides: GuideMeta[] | null, appid: number | undefined): GuideMeta[] {
  if (!guides || appid == null) return [];
  return guides
    .filter((g) => g.appid === appid)
    .sort((a, b) => a.title.localeCompare(b.title));
}
