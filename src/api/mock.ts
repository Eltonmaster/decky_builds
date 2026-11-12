// In-memory stand-in for the Python backend. Same method names, arguments and
// events as the contract, fed from the example guides. Only bundled when the
// plugin is built with `pnpm build:mock`.
import type { BackendApi, BackendEventSource, BackendEvents, EventName } from "./types";
import type { AutoStopMinutes, Game, Guide, GuideMeta, Progress, ServerStatus, Upload } from "../types";
import erBleed from "./mock-guides/er-bleed-samurai.json";
import sdvSpring from "./mock-guides/sdv-spring-y1.json";
import balBaron from "./mock-guides/bal-mime-baron.json";

const MOCK_GAMES: Game[] = [
  { appid: 1245620, name: "ELDEN RING" },
  { appid: 413150, name: "Stardew Valley" },
  { appid: 2379780, name: "Balatro" },
  { appid: 367520, name: "Hollow Knight" },
  { appid: 1145360, name: "Hades" },
  { appid: 588650, name: "Dead Cells" },
  { appid: 504230, name: "Celeste" },
  { appid: 1091500, name: "Cyberpunk 2077" },
  { appid: 646570, name: "Slay the Spire" },
  { appid: 1086940, name: "Baldur's Gate 3" },
  { appid: 892970, name: "Valheim" },
  { appid: 1794680, name: "Vampire Survivors" },
].sort((a, b) => a.name.localeCompare(b.name));

const now = () => Math.floor(Date.now() / 1000);
const delay = <T>(value: T, ms = 60): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(structuredClone(value)), ms));

function metaOf(g: Guide, received_at: number): GuideMeta {
  return {
    id: g.id,
    title: g.title,
    appid: g.game.appid,
    game_name: g.game.name,
    author: g.author ?? null,
    updated: g.updated ?? null,
    tags: g.tags ?? [],
    summary: g.summary ?? null,
    section_count: g.sections.length,
    received_at,
  };
}

export function createMockBackend(): { api: BackendApi; events: BackendEventSource } {
  const guides = new Map<string, { guide: Guide; received_at: number }>();
  for (const [i, g] of [erBleed, sdvSpring, balBaron].entries()) {
    guides.set(g.id, { guide: g as unknown as Guide, received_at: now() - 86400 * (i + 1) });
  }
  const progress = new Map<string, Progress>();
  const uploads: Upload[] = [];
  let status: ServerStatus = {
    running: false, url: null, port: null, pairing_code: null, auto_stop_minutes: 15, stops_at: null,
  };
  let stopTimer: ReturnType<typeof setTimeout> | undefined;
  const demoTimers: ReturnType<typeof setTimeout>[] = [];

  const listeners = new Map<EventName, Set<(...args: any[]) => void>>();
  function emit<E extends EventName>(event: E, ...args: BackendEvents[E]) {
    listeners.get(event)?.forEach((l) => l(...structuredClone(args)));
  }
  const allMeta = () => [...guides.values()].map((v) => metaOf(v.guide, v.received_at));

  function scheduleStop() {
    clearTimeout(stopTimer);
    const minutes = status.auto_stop_minutes;
    status.stops_at = status.running && minutes > 0 ? now() + minutes * 60 : null;
    if (status.running && minutes > 0) stopTimer = setTimeout(() => void api.stop_server(), minutes * 60_000);
  }

  function pushUpload(u: Upload) {
    uploads.unshift(u);
    uploads.splice(20);
    emit("upload_received", u);
  }

  function getProgress(id: string): Progress {
    let p = progress.get(id);
    if (!p) progress.set(id, (p = { checks: {}, last_section: null }));
    return p;
  }

  function requireGuide(id: string) {
    const entry = guides.get(id);
    if (!entry) throw new Error(`No guide with id "${id}".`);
    return entry;
  }

  const api: BackendApi = {
    get_server_status: () => delay(status),
    async start_server(minutes) {
      status = {
        running: true,
        url: "http://192.168.1.42:8787",
        port: 8787,
        pairing_code: String(Math.floor(100000 + Math.random() * 900000)),
        auto_stop_minutes: minutes as AutoStopMinutes,
        stops_at: null,
      };
      scheduleStop();
      emit("server_status", status);
      // Pretend a PC sends one good and one broken file shortly after.
      demoTimers.push(
        setTimeout(() => {
          const entry = guides.get("bal-mime-baron");
          if (entry) {
            entry.received_at = now();
            pushUpload({ file: "bal-mime-baron.json", received_at: now(), ok: true, guide_id: entry.guide.id, error: null });
            emit("guides_changed", allMeta());
          }
        }, 4000),
        setTimeout(() => {
          pushUpload({
            file: "hk-charms.json",
            received_at: now(),
            ok: false,
            guide_id: null,
            error: "sections[1].blocks[0] (table): row 4 has 3 cells, but the table has 4 columns. (+1 more)",
          });
        }, 8000),
      );
      return delay(status);
    },
    async stop_server() {
      clearTimeout(stopTimer);
      demoTimers.splice(0).forEach(clearTimeout);
      status = { ...status, running: false, url: null, port: null, pairing_code: null, stops_at: null };
      emit("server_status", status);
      return delay(status);
    },
    async set_auto_stop(minutes) {
      status.auto_stop_minutes = minutes as AutoStopMinutes;
      scheduleStop();
      emit("server_status", status);
      return delay(status);
    },
    list_installed_games: () => delay(MOCK_GAMES),
    list_guides: () => delay(allMeta()),
    get_guide: async (id) => delay(requireGuide(id).guide, 120),
    async rename_guide(id, title) {
      const trimmed = title.trim();
      if (!trimmed) throw new Error("The title can't be empty.");
      const entry = requireGuide(id);
      entry.guide.title = trimmed;
      emit("guides_changed", allMeta());
      return delay(metaOf(entry.guide, entry.received_at));
    },
    async delete_guide(id) {
      requireGuide(id);
      guides.delete(id);
      progress.delete(id);
      emit("guides_changed", allMeta());
      return delay(true as const);
    },
    list_uploads: () => delay(uploads),
    get_progress: async (id) => delay(getProgress(id)),
    async set_check(id, key, value) {
      const p = getProgress(id);
      if (value) p.checks[key] = true;
      else delete p.checks[key];
      return delay(p, 20);
    },
    async set_last_section(id, index) {
      const p = getProgress(id);
      p.last_section = index;
      return delay(p, 20);
    },
  };

  const events: BackendEventSource = {
    on(event, listener) {
      let set = listeners.get(event);
      if (!set) listeners.set(event, (set = new Set()));
      set.add(listener as (...args: any[]) => void);
      return () => set!.delete(listener as (...args: any[]) => void);
    },
  };

  return { api, events };
}
