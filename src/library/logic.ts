import type { Game, GuideMeta } from "../types";

export type LibraryEntry = {
  appid: number;
  name: string;
  installed: boolean;
  playing: boolean;
  guides: GuideMeta[];
};

/**
 * Orders the library: running game first, then games with guides, then the
 * rest, each group by name. Guides for games that are not installed still
 * show up so they can be read, renamed or deleted.
 */
export function buildLibrary(games: Game[], guides: GuideMeta[], runningAppid: number | null): LibraryEntry[] {
  const byApp = new Map<number, LibraryEntry>();
  for (const g of games) {
    byApp.set(g.appid, { appid: g.appid, name: g.name, installed: true, playing: false, guides: [] });
  }
  for (const guide of guides) {
    let entry = byApp.get(guide.appid);
    if (!entry) {
      entry = { appid: guide.appid, name: guide.game_name, installed: false, playing: false, guides: [] };
      byApp.set(guide.appid, entry);
    }
    entry.guides.push(guide);
  }
  const entries = [...byApp.values()];
  for (const e of entries) {
    e.guides.sort((a, b) => a.title.localeCompare(b.title));
    e.playing = runningAppid != null && e.appid === runningAppid;
  }
  const rank = (e: LibraryEntry) => (e.playing ? 0 : e.guides.length > 0 ? 1 : 2);
  return entries.sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
}

export type FilteredEntry = LibraryEntry & {
  /** Guides to show when the game is expanded: all of them, or only the matches. */
  shownGuides: GuideMeta[];
  /** True when the match came from a guide, so the game should open up. */
  matchedGuide: boolean;
};

function norm(s: string) {
  return s.toLocaleLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "");
}

/** Searches game names, guide titles, tags and summaries. */
export function filterLibrary(entries: LibraryEntry[], query: string): FilteredEntry[] {
  const terms = norm(query).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return entries.map((e) => ({ ...e, shownGuides: e.guides, matchedGuide: false }));
  const out: FilteredEntry[] = [];
  for (const e of entries) {
    const gameText = norm(e.name);
    const guideMatches = e.guides.filter((g) => {
      const text = norm([e.name, g.title, g.tags.join(" "), g.summary ?? "", g.author ?? ""].join(" "));
      return terms.every((t) => text.includes(t));
    });
    const gameMatches = terms.every((t) => gameText.includes(t));
    if (gameMatches) out.push({ ...e, shownGuides: e.guides, matchedGuide: false });
    else if (guideMatches.length) out.push({ ...e, shownGuides: guideMatches, matchedGuide: true });
  }
  return out;
}
