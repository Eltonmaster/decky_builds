import { Focusable, GamepadButton, Navigation, useParams, type GamepadEvent } from "@decky/ui";
import { toaster } from "@decky/api";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, errorMessage } from "../api";
import { Cover } from "../components/Cover";
import { Glyph } from "../components/Glyph";
import { RichText } from "../components/RichText";
import { Styles } from "../components/Styles";
import { absorb, focusElement, isRepeat } from "../nav";
import type { Block, Guide, Progress } from "../types";
import { CalloutBody, HeadingBody, ListBody, StatsBody, Stop, TextBody, calloutClass, edgeHandler } from "./blocks";
import { ensureVisible } from "./ensureVisible";
import { checkKey, clampSection, guideCheckTotals, isFocusStop } from "./logic";
import { TableView } from "./TableView";

export function GuideRoute() {
  const { id } = useParams<{ id: string }>();
  return <GuideViewer key={id} guideId={decodeURIComponent(id)} />;
}

type Pending = "first" | "last" | null;

export function GuideViewer({ guideId }: { guideId: string }) {
  const [guide, setGuide] = useState<Guide | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [section, setSection] = useState(0);
  const [tableLive, setTableLive] = useState(false);
  const [pending, setPending] = useState<Pending>("first");

  const contentRef = useRef<HTMLDivElement>(null);
  const stopRefs = useRef<(HTMLElement | null)[]>([]);
  const tocRefs = useRef<(HTMLElement | null)[]>([]);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Load the guide and where the reader left off.
  useEffect(() => {
    let alive = true;
    Promise.all([api.get_guide(guideId), api.get_progress(guideId)])
      .then(([g, p]: [Guide, Progress]) => {
        if (!alive) return;
        setGuide(g);
        setChecks(p.checks ?? {});
        setSection(clampSection(p.last_section, g.sections.length));
        setPending("first");
      })
      .catch((e) => alive && setError(errorMessage(e)));
    return () => {
      alive = false;
      clearTimeout(saveTimer.current);
    };
  }, [guideId]);

  const sectionCount = guide?.sections.length ?? 0;
  const current = guide?.sections[section];

  const goToSection = useCallback(
    (index: number, focus: Pending = "first") => {
      if (!guide) return;
      const next = clampSection(index, guide.sections.length);
      setTableLive(false);
      setPending(focus);
      if (next === section) return;
      setSection(next);
      if (contentRef.current) contentRef.current.scrollTop = 0;
      clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        api.set_last_section(guide.id, next).catch(() => {
          /* losing the bookmark is not worth a toast */
        });
      }, 400);
    },
    [guide, section],
  );

  // Move focus once the new section has rendered.
  useEffect(() => {
    if (!pending || !current) return;
    const count = stopRefs.current.length;
    const index = pending === "first" ? 0 : count - 1;
    if (pending === "first" && contentRef.current) contentRef.current.scrollTop = 0;
    focusElement(() => stopRefs.current[index]);
    setPending(null);
  }, [pending, current]);

  const toggleCheck = (key: string) => {
    if (!guide) return;
    const value = !checks[key];
    setChecks((c) => ({ ...c, [key]: value }));
    api.set_check(guide.id, key, value).catch((e) => {
      setChecks((c) => ({ ...c, [key]: !value }));
      toaster.toast({ title: "Couldn't save checklist", body: errorMessage(e) });
    });
  };

  const onFocusStop = useCallback((el: HTMLElement) => {
    const index = stopRefs.current.indexOf(el);
    if (index === 0 && contentRef.current) contentRef.current.scrollTop = 0;
    else ensureVisible(contentRef.current, el, { top: 0, left: 0, margin: 24 });
  }, []);

  const openContents = (evt?: GamepadEvent) => {
    if (tableLive) return false;
    focusElement(() => tocRefs.current[section]);
    return evt ? absorb(evt) : true;
  };

  const onButtonDown = (evt: GamepadEvent) => {
    if (tableLive || isRepeat(evt)) return;
    const b = evt.detail.button;
    if (b === GamepadButton.BUMPER_LEFT && section > 0) {
      absorb(evt);
      goToSection(section - 1);
    } else if (b === GamepadButton.BUMPER_RIGHT && section < sectionCount - 1) {
      absorb(evt);
      goToSection(section + 1);
    }
  };

  const totals = useMemo(() => (guide ? guideCheckTotals(guide, checks) : { done: 0, total: 0 }), [guide, checks]);

  if (error) {
    return (
      <div className="dbx-root dbx-page">
        <Styles />
        <div className="dbx-loading">Couldn't open this guide: {error}</div>
      </div>
    );
  }
  if (!guide || !current) {
    return (
      <div className="dbx-root dbx-page">
        <Styles />
        <div className="dbx-loading">Loading guide…</div>
      </div>
    );
  }

  // Render blocks, numbering focus stops as we go (checklist items are one stop each).
  stopRefs.current = [];
  const stopCount = countStops(current.blocks);
  let stopIndex = 0;
  const hasNext = section < sectionCount - 1;
  const hasPrev = section > 0;
  const nextStop = () => {
    const i = stopIndex++;
    return {
      ref: (el: HTMLElement | null) => {
        stopRefs.current[i] = el;
      },
      onEdge: edgeHandler({
        first: i === 0 && hasPrev,
        last: i === stopCount - 1 && hasNext,
        onNext: () => goToSection(section + 1, "first"),
        onPrev: () => goToSection(section - 1, "last"),
      }),
      onFocusStop,
    };
  };

  const renderBlock = (block: Block, bi: number) => {
    switch (block.type) {
      case "heading":
        return <HeadingBody key={bi} text={block.text} />;
      case "text":
        return (
          <Stop key={bi} {...nextStop()}>
            <TextBody text={block.text} />
          </Stop>
        );
      case "list":
        return (
          <Stop key={bi} {...nextStop()}>
            <ListBody block={block} />
          </Stop>
        );
      case "stats":
        return (
          <Stop key={bi} {...nextStop()}>
            <StatsBody block={block} />
          </Stop>
        );
      case "callout":
        return (
          <Stop key={bi} className={calloutClass(block)} {...nextStop()}>
            <CalloutBody block={block} />
          </Stop>
        );
      case "table":
        return <TableView key={bi} block={block} onLiveChange={setTableLive} {...nextStop()} />;
      case "checklist":
        return (
          <div key={bi} className="dbx-ck-group">
            {block.items.map((item) => {
              const key = checkKey(block.id, item.id);
              const done = !!checks[key];
              return (
                <Stop
                  key={item.id}
                  className={`dbx-ck${done ? " done" : ""}`}
                  onActivate={() => toggleCheck(key)}
                  okLabel={done ? "Untick" : "Tick"}
                  {...nextStop()}
                >
                  <span className="dbx-box">{done ? "✓" : ""}</span>
                  <span className="dbx-ck-t">
                    <RichText value={item.text} />
                  </span>
                </Stop>
              );
            })}
          </div>
        );
      default:
        return null;
    }
  };

  const next = guide.sections[section + 1];

  return (
    <div className="dbx-root dbx-page">
      <Styles />
      <div className="dbx-topbar dbx-vw-top">
        <Cover appid={guide.game.appid} name={guide.game.name} />
        <div>
          <div className="dbx-vw-game">{guide.game.name}</div>
          <div className="dbx-vw-title">{guide.title}</div>
        </div>
        <div className="dbx-vw-meta">
          {totals.total > 0 && (
            <span className="dbx-prog">
              <span className="dbx-prog-bar">
                <i style={{ width: `${Math.round((totals.done / totals.total) * 100)}%` }} />
              </span>
              {totals.done}/{totals.total}
            </span>
          )}
          <span>
            <Glyph button="L1" /> <Glyph button="R1" /> sections · <Glyph button="Y" /> contents
          </span>
        </div>
      </div>
      <Focusable
        className="dbx-vw-body"
        flow-children="row"
        onButtonDown={onButtonDown}
        onOptionsButton={openContents}
        actionDescriptionMap={
          tableLive
            ? {}
            : {
                [GamepadButton.OPTIONS]: "Contents",
                ...(hasPrev ? { [GamepadButton.BUMPER_LEFT]: "Previous section" } : {}),
                ...(hasNext ? { [GamepadButton.BUMPER_RIGHT]: "Next section" } : {}),
              }
        }
      >
        <Focusable
          className="dbx-toc"
          flow-children="column"
          onCancelButton={(evt: GamepadEvent) => {
            focusElement(() => stopRefs.current[0]);
            return absorb(evt);
          }}
          onCancelActionDescription="Back to reading"
        >
          <div className="dbx-d-k">Contents</div>
          {guide.sections.map((s, i) => (
            <Focusable
              key={s.id}
              ref={(el: HTMLDivElement | null) => {
                tocRefs.current[i] = el;
              }}
              className={`dbx-toc-i${i === section ? " cur" : ""}`}
              focusClassName="dbx-focus"
              noFocusRing
              onActivate={() => goToSection(i, "first")}
              onOKActionDescription="Go to section"
            >
              <b>{i + 1}</b>
              <span>{s.title}</span>
            </Focusable>
          ))}
        </Focusable>
        <div className="dbx-vw-content" ref={contentRef}>
          <div className="dbx-sec-head">
            <div className="dbx-sec-title">{current.title}</div>
            <div className="dbx-sec-pos">
              Section {section + 1} of {sectionCount}
            </div>
          </div>
          <Focusable className="dbx-blocks" flow-children="column">
            {current.blocks.map((b, i) => (
              <Fragment key={`${current.id}-${i}`}>{renderBlock(b, i)}</Fragment>
            ))}
          </Focusable>
          <div className="dbx-sec-next">
            {next ? (
              <>
                <Glyph button="R1" /> Next: {next.title}
              </>
            ) : (
              <>End of guide</>
            )}
          </div>
        </div>
      </Focusable>
    </div>
  );
}

function countStops(blocks: Block[]) {
  return blocks.reduce((n, b) => n + (b.type === "checklist" ? b.items.length : isFocusStop(b) ? 1 : 0), 0);
}

export function openGuide(id: string) {
  Navigation.Navigate(`/decky-builds/guide/${encodeURIComponent(id)}`);
  Navigation.CloseSideMenus();
}
