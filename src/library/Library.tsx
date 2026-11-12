import { Focusable, GamepadButton, TextField, type GamepadEvent } from "@decky/ui";
import { toaster } from "@decky/api";
import { useEffect, useMemo, useRef, useState } from "react";
import { errorMessage } from "../api";
import { Cover } from "../components/Cover";
import { Glyph } from "../components/Glyph";
import { Styles } from "../components/Styles";
import { absorb, focusElement } from "../nav";
import { refreshGames, refreshGuides, refreshRunning, useStore } from "../store";
import type { GuideMeta } from "../types";
import { openGuide } from "../viewer/GuideViewer";
import { ensureVisible } from "../viewer/ensureVisible";
import { showGuideMenu } from "./GuideActions";
import { buildLibrary, filterLibrary, type FilteredEntry } from "./logic";

type Focused = { kind: "game"; appid: number } | { kind: "guide"; id: string } | null;

export function LibraryRoute() {
  const games = useStore((s) => s.games);
  const guides = useStore((s) => s.guides);
  const running = useStore((s) => s.running);
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [focused, setFocused] = useState<Focused>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const firstRowRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    refreshRunning();
    Promise.all([refreshGames(), refreshGuides()]).catch((e) =>
      toaster.toast({ title: "Couldn't load the library", body: errorMessage(e) }),
    );
  }, []);

  // The running game starts opened up.
  useEffect(() => {
    if (running) setExpanded((s) => new Set(s).add(running.appid));
  }, [running?.appid]);

  const entries = useMemo(
    () => (games && guides ? buildLibrary(games, guides, running?.appid ?? null) : null),
    [games, guides, running?.appid],
  );
  const shown = useMemo(() => (entries ? filterLibrary(entries, query) : []), [entries, query]);

  // Focus the first row when the page opens.
  const didFocus = useRef(false);
  useEffect(() => {
    if (!didFocus.current && shown.length) {
      didFocus.current = true;
      focusElement(() => firstRowRef.current);
    }
  }, [shown.length]);

  const toggle = (appid: number, open?: boolean) =>
    setExpanded((s) => {
      const next = new Set(s);
      const isOpen = next.has(appid);
      if (open ?? !isOpen) next.add(appid);
      else next.delete(appid);
      return next;
    });

  const focusSearch = (evt: GamepadEvent) => {
    const input = searchRef.current?.querySelector("input");
    focusElement(() => input ?? searchRef.current);
    return absorb(evt);
  };

  const withGuides = guides?.length ?? 0;
  const detail = describeFocused(focused, shown);

  return (
    <div className="dbx-root dbx-page">
      <Styles />
      <div className="dbx-topbar">
        <div className="dbx-crumb">
          Decky Builds<span>/</span>Library
        </div>
        <div className="dbx-count">
          {entries ? `${games?.length ?? 0} installed · ${withGuides} guide${withGuides === 1 ? "" : "s"}` : ""}
        </div>
      </div>
      <div className="dbx-lib">
        <Focusable
          className="dbx-lib-left"
          flow-children="column"
          onOptionsButton={focusSearch}
          onOptionsActionDescription="Search"
        >
          <div className="dbx-lib-search" ref={searchRef}>
            <TextField
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              bShowClearAction
              {...({ placeholder: "Search games, guides and tags" } as object)}
            />
          </div>
          <Focusable className="dbx-lib-list" flow-children="column" ref={listRef}>
            {!entries && <div className="dbx-empty">Loading…</div>}
            {entries && shown.length === 0 && <div className="dbx-empty">Nothing matches "{query}".</div>}
            {shown.map((e, i) => {
              const open = e.guides.length > 0 && (expanded.has(e.appid) || e.matchedGuide);
              return (
                <GameRow
                  key={e.appid}
                  entry={e}
                  open={open}
                  rowRef={i === 0 ? (el) => (firstRowRef.current = el) : undefined}
                  onToggle={(force) => e.guides.length > 0 && toggle(e.appid, force)}
                  onFocus={(f, el) => {
                    setFocused(f);
                    ensureVisible(listRef.current, el, { top: 0, left: 0, margin: 8 });
                  }}
                />
              );
            })}
          </Focusable>
        </Focusable>
        <Detail detail={detail} />
      </div>
    </div>
  );
}

function GameRow({
  entry, open, rowRef, onToggle, onFocus,
}: {
  entry: FilteredEntry;
  open: boolean;
  rowRef?: (el: HTMLDivElement | null) => void;
  onToggle(force?: boolean): void;
  onFocus(f: Focused, el: HTMLElement): void;
}) {
  const n = entry.guides.length;
  const sub = n
    ? `${n} guide${n === 1 ? "" : "s"}${entry.installed ? "" : " · not installed"}`
    : "No guides";
  return (
    <>
      <Focusable
        ref={rowRef}
        className={`dbx-game${entry.playing ? " playing" : ""}`}
        focusClassName="dbx-focus"
        noFocusRing
        onActivate={() => onToggle()}
        onOKActionDescription={n ? (open ? "Collapse" : "Show guides") : ""}
        onGamepadFocus={(evt: GamepadEvent) => onFocus({ kind: "game", appid: entry.appid }, evt.currentTarget as HTMLElement)}
        onGamepadDirection={(evt: GamepadEvent) => {
          const b = evt.detail.button;
          if (n && b === GamepadButton.DIR_RIGHT && !open) return (onToggle(true), absorb(evt));
          if (n && b === GamepadButton.DIR_LEFT && open) return (onToggle(false), absorb(evt));
          return false;
        }}
      >
        <Cover appid={entry.appid} name={entry.name} />
        <div className="dbx-game-main">
          <div className="dbx-game-name">
            {entry.name}
            {entry.playing && <span className="dbx-badge">Playing</span>}
          </div>
          <div className={`dbx-game-sub${n ? " has" : ""}`}>{sub}</div>
        </div>
        {n > 0 && <span className="dbx-chev">{open ? "▾" : "▸"}</span>}
      </Focusable>
      {open &&
        entry.shownGuides.map((g) => (
          <Focusable
            key={g.id}
            className="dbx-grow"
            focusClassName="dbx-focus"
            noFocusRing
            onActivate={() => openGuide(g.id)}
            onOKActionDescription="Open guide"
            onSecondaryButton={(evt: GamepadEvent) => {
              showGuideMenu(g, evt.currentTarget ?? undefined);
              return absorb(evt);
            }}
            onSecondaryActionDescription="Rename or delete"
            onGamepadFocus={(evt: GamepadEvent) => onFocus({ kind: "guide", id: g.id }, evt.currentTarget as HTMLElement)}
            onGamepadDirection={(evt: GamepadEvent) => {
              if (evt.detail.button === GamepadButton.DIR_LEFT) return (onToggle(false), absorb(evt));
              return false;
            }}
          >
            <span className="dbx-grow-t">{g.title}</span>
            <span className="dbx-grow-s">
              {g.section_count} section{g.section_count === 1 ? "" : "s"}
            </span>
          </Focusable>
        ))}
      {open && entry.shownGuides.length > 0 && (
        <div className="dbx-ghint">
          <Glyph button="A" /> open · <Glyph button="X" /> rename or delete
        </div>
      )}
    </>
  );
}

type Detail =
  | { kind: "game"; entry: FilteredEntry }
  | { kind: "guide"; entry: FilteredEntry; guide: GuideMeta }
  | null;

function describeFocused(focused: Focused, shown: FilteredEntry[]): Detail {
  if (!focused) return null;
  for (const entry of shown) {
    if (focused.kind === "game" && entry.appid === focused.appid) return { kind: "game", entry };
    if (focused.kind === "guide") {
      const guide = entry.guides.find((g) => g.id === focused.id);
      if (guide) return { kind: "guide", entry, guide };
    }
  }
  return null;
}

function Detail({ detail }: { detail: Detail }) {
  if (!detail) {
    return (
      <div className="dbx-detail">
        <div className="dbx-d-k">Library</div>
        <div className="dbx-d-sum">
          Every installed game is listed here. Games with guides come first. Press <Glyph button="Y" /> to search.
        </div>
      </div>
    );
  }
  const { entry } = detail;
  if (detail.kind === "game") {
    return (
      <div className="dbx-detail">
        <Cover appid={entry.appid} name={entry.name} className="dbx-d-cover" />
        <div className="dbx-d-k">{entry.playing ? "Playing now" : entry.installed ? "Installed" : "Not installed"}</div>
        <div className="dbx-d-title">{entry.name}</div>
        <div className="dbx-d-sum">
          {entry.guides.length
            ? `${entry.guides.length} guide${entry.guides.length === 1 ? "" : "s"}: ${entry.guides.map((g) => g.title).join(", ")}`
            : "No guides yet. Turn on uploads in the Quick Access panel to add one from your PC."}
        </div>
      </div>
    );
  }
  const g = detail.guide;
  return (
    <div className="dbx-detail">
      <div className="dbx-d-k">{entry.name}</div>
      <div className="dbx-d-title">{g.title}</div>
      {g.summary && <div className="dbx-d-sum">{g.summary}</div>}
      {g.tags.length > 0 && (
        <div className="dbx-chips">
          {g.tags.map((t) => (
            <span key={t} className="dbx-chip">
              {t}
            </span>
          ))}
        </div>
      )}
      <div className="dbx-d-sum" style={{ color: "#8b95a5", fontSize: 14 }}>
        {[g.author && `By ${g.author}`, g.updated && `Updated ${g.updated}`, `${g.section_count} section${g.section_count === 1 ? "" : "s"}`]
          .filter(Boolean)
          .join(" · ")}
      </div>
    </div>
  );
}
