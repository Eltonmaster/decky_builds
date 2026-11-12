import { plainText } from "../rich";
import type { Block, ChecklistBlock, Guide, TableCell } from "../types";

export type SortState = { column: number; dir: "asc" | "desc" } | null;

const EMPTY_MARKS = new Set(["", "—", "-", "–", "n/a", "N/A"]);

function sortKey(cell: TableCell): { empty: boolean; num: number | null; text: string } {
  if (typeof cell === "number") return { empty: false, num: cell, text: String(cell) };
  const text = plainText(cell).trim();
  if (EMPTY_MARKS.has(text)) return { empty: true, num: null, text };
  const numeric = text.replace(/[,\s]/g, "").match(/^[-+]?\d+(\.\d+)?/);
  const num = numeric && numeric[0].length >= text.replace(/[,\s]/g, "").length - 2 ? Number(numeric[0]) : null;
  return { empty: false, num, text };
}

/** Compares two cells: numbers numerically, text naturally, empty marks always last. */
export function compareCells(a: TableCell, b: TableCell, dir: "asc" | "desc" = "asc"): number {
  const ka = sortKey(a);
  const kb = sortKey(b);
  if (ka.empty !== kb.empty) return ka.empty ? 1 : -1;
  if (ka.empty) return 0;
  let r: number;
  if (ka.num != null && kb.num != null) r = ka.num - kb.num;
  else if (ka.num != null) r = -1;
  else if (kb.num != null) r = 1;
  else r = ka.text.localeCompare(kb.text, undefined, { numeric: true, sensitivity: "base" });
  return dir === "asc" ? r : -r;
}

/** Returns row indexes in display order. Sorting is stable. */
export function sortedRowOrder(rows: TableCell[][], sort: SortState): number[] {
  const order = rows.map((_, i) => i);
  if (!sort) return order;
  return order.sort((a, b) => compareCells(rows[a][sort.column], rows[b][sort.column], sort.dir) || a - b);
}

/** X cycles a column: ascending, descending, then back to the file's order. */
export function nextSort(current: SortState, column: number): SortState {
  if (!current || current.column !== column) return { column, dir: "asc" };
  if (current.dir === "asc") return { column, dir: "desc" };
  return null;
}

export function checkKey(checklistId: string, itemId: string) {
  return `${checklistId}:${itemId}`;
}

export function checklistKeys(blocks: Block[]): string[] {
  return blocks
    .filter((b): b is ChecklistBlock => b.type === "checklist")
    .flatMap((b) => b.items.map((it) => checkKey(b.id, it.id)));
}

export function guideCheckTotals(guide: Guide, checks: Record<string, boolean>) {
  const keys = guide.sections.flatMap((s) => checklistKeys(s.blocks));
  return { done: keys.filter((k) => checks[k]).length, total: keys.length };
}

export function clampSection(index: number | null | undefined, sectionCount: number): number {
  if (index == null || !Number.isFinite(index) || sectionCount <= 0) return 0;
  return Math.min(Math.max(0, Math.trunc(index)), sectionCount - 1);
}

/** Headings are labels, not focus stops. Every other block takes focus. */
export function isFocusStop(block: Block): boolean {
  return block.type !== "heading";
}
