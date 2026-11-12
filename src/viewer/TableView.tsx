import { Focusable, GamepadButton, type GamepadEvent } from "@decky/ui";
import { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import { RichText } from "../components/RichText";
import { Glyph } from "../components/Glyph";
import { absorb } from "../nav";
import type { TableBlock } from "../types";
import { ensureVisible } from "./ensureVisible";
import { nextSort, sortedRowOrder, type SortState } from "./logic";

type Props = {
  block: TableBlock;
  /** Called with true when the table takes over the D-pad, false when it gives it back. */
  onLiveChange(live: boolean): void;
  /** Section paging at the first/last focus stop. Returns true when it handled the press. */
  onEdge?(button: number): boolean;
  onFocusStop(el: HTMLElement): void;
};

const ALIGN_CLASS = { left: "", right: "r", center: "c" } as const;

/**
 * A table block. Reading mode: one focus stop, A enters. Cell mode: the D-pad
 * moves a cell cursor (the header and optionally the first column stay pinned),
 * X sorts by the current column, B leaves.
 */
export const TableView = forwardRef<HTMLDivElement, Props>(function TableView({ block, onLiveChange, onEdge, onFocusStop }, ref) {
  const [live, setLive] = useState(false);
  const [cursor, setCursor] = useState({ row: 0, col: 0 });
  const [sort, setSort] = useState<SortState>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const order = useMemo(() => sortedRowOrder(block.rows, sort), [block.rows, sort]);
  const rowCount = block.rows.length;
  const colCount = block.columns.length;

  const setLiveState = (next: boolean) => {
    setLive(next);
    onLiveChange(next);
  };

  // Keep the cursor's cell in view, clear of the pinned header and first column.
  useEffect(() => {
    if (!live) return;
    const box = scrollRef.current;
    const cell = box?.querySelector<HTMLElement>(`[data-cell="${cursor.row}:${cursor.col}"]`);
    const head = box?.querySelector<HTMLElement>("thead");
    const first = block.stickyFirstColumn && cursor.col > 0 ? box?.querySelector<HTMLElement>("th") : null;
    ensureVisible(box ?? null, cell ?? null, { top: head?.offsetHeight ?? 0, left: first?.offsetWidth ?? 0, margin: 0 });
  }, [live, cursor, block.stickyFirstColumn]);

  // Leaving the table resets its scroll so the reading view shows the top.
  useEffect(() => {
    if (!live && scrollRef.current) {
      scrollRef.current.scrollTop = 0;
      scrollRef.current.scrollLeft = 0;
    }
  }, [live]);

  const onDirection = (evt: GamepadEvent) => {
    const button = evt.detail.button;
    if (!live) return onEdge ? onEdge(button) && absorb(evt) : false;
    setCursor(({ row, col }) => {
      switch (button) {
        case GamepadButton.DIR_UP: return { row: Math.max(0, row - 1), col };
        case GamepadButton.DIR_DOWN: return { row: Math.min(rowCount - 1, row + 1), col };
        case GamepadButton.DIR_LEFT: return { row, col: Math.max(0, col - 1) };
        case GamepadButton.DIR_RIGHT: return { row, col: Math.min(colCount - 1, col + 1) };
        default: return { row, col };
      }
    });
    return absorb(evt);
  };

  const legend = live
    ? {
        [GamepadButton.SECONDARY]: sortLabel(sort, cursor.col, block.columns[cursor.col]?.label),
        [GamepadButton.CANCEL]: "Leave table",
      }
    : { [GamepadButton.OK]: "Enter table" };

  return (
    <Focusable
      ref={ref}
      className={`dbx-blk dbx-table${live ? " live" : ""}`}
      focusClassName="dbx-focus"
      noFocusRing
      actionDescriptionMap={legend}
      onActivate={() => {
        if (!live && rowCount > 0) {
          setCursor({ row: 0, col: 0 });
          setLiveState(true);
        }
      }}
      onGamepadDirection={onDirection}
      onCancelButton={(evt: GamepadEvent) => {
        if (!live) return false;
        setLiveState(false);
        return absorb(evt);
      }}
      onSecondaryButton={(evt: GamepadEvent) => {
        if (!live) return false;
        setSort((s) => nextSort(s, cursor.col));
        return absorb(evt);
      }}
      onGamepadFocus={(evt: GamepadEvent) => onFocusStop(evt.currentTarget as HTMLElement)}
      onGamepadBlur={() => live && setLiveState(false)}
    >
      <div className="dbx-tbl-cap">
        <span>{block.caption ?? ""}</span>
        <span className="dbx-tbl-hint">
          {live ? (
            <>
              <Glyph button="X" /> sort · <Glyph button="B" /> leave
            </>
          ) : (
            <>
              <Glyph button="A" /> browse cells
            </>
          )}
        </span>
      </div>
      <div ref={scrollRef} className={`dbx-tbl${block.stickyFirstColumn ? " sticky" : ""}`}>
        <table>
          <thead>
            <tr>
              {block.columns.map((col, c) => (
                <th key={c} className={`${ALIGN_CLASS[col.align ?? "left"]}${live && c === cursor.col ? " col-on" : ""}`}>
                  {col.label}
                  {sort?.column === c && <span className="dbx-sort">{sort.dir === "asc" ? "▲" : "▼"}</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {order.map((rowIndex, r) => (
              <tr key={rowIndex} className={live && r === cursor.row ? "row-on" : undefined}>
                {block.columns.map((col, c) => (
                  <td
                    key={c}
                    data-cell={`${r}:${c}`}
                    className={`dbx-cell ${ALIGN_CLASS[col.align ?? "left"]}${live && r === cursor.row && c === cursor.col ? " dbx-focus" : ""}`}
                  >
                    <RichText value={block.rows[rowIndex][c]} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Focusable>
  );
});

function sortLabel(sort: SortState, col: number, label: string | undefined) {
  const name = label ?? "column";
  if (!sort || sort.column !== col) return `Sort by ${name}`;
  return sort.dir === "asc" ? `Sort ${name} descending` : "Original order";
}
