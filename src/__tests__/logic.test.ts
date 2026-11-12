import { describe, expect, it } from "vitest";
import { buildLibrary, filterLibrary } from "../library/logic";
import { plainText } from "../rich";
import type { Guide, GuideMeta } from "../types";
import { checkKey, clampSection, compareCells, guideCheckTotals, nextSort, sortedRowOrder } from "../viewer/logic";
import er from "../api/mock-guides/er-bleed-samurai.json";
import sdv from "../api/mock-guides/sdv-spring-y1.json";

const meta = (id: string, appid: number, game: string, title: string, tags: string[] = []): GuideMeta => ({
  id, title, appid, game_name: game, author: null, updated: null, tags, summary: null, section_count: 1, received_at: 0,
});

describe("plainText", () => {
  it("flattens strings, numbers, spans and arrays", () => {
    expect(plainText("a")).toBe("a");
    expect(plainText(5)).toBe("5");
    expect(plainText({ b: "bold" })).toBe("bold");
    expect(plainText(["Press ", { btn: "X" }, " to ", { hl: "sort" }])).toBe("Press X to sort");
  });
});

describe("table sorting", () => {
  const rows = (sdv as unknown as Guide).sections[1].blocks[0] as any;
  it("sorts numbers numerically and keeps em dashes last both ways", () => {
    const asc = sortedRowOrder(rows.rows, { column: 4, dir: "asc" }).map((i) => rows.rows[i][4]);
    expect(asc).toEqual([3, 4, "—", "—", "—", "—", "—"]);
    const desc = sortedRowOrder(rows.rows, { column: 4, dir: "desc" }).map((i) => rows.rows[i][4]);
    expect(desc).toEqual([4, 3, "—", "—", "—", "—", "—"]);
  });
  it("sorts text naturally and stably", () => {
    expect(compareCells("Item 2", "Item 10")).toBeLessThan(0);
    const order = sortedRowOrder([["b"], ["a"], ["b"], ["a"]], { column: 0, dir: "asc" });
    expect(order).toEqual([1, 3, 0, 2]);
  });
  it("reads numbers with thousands separators", () => {
    expect(compareCells("1,000g", "900g")).toBeGreaterThan(0);
  });
  it("cycles asc, desc, original", () => {
    let s = nextSort(null, 2);
    expect(s).toEqual({ column: 2, dir: "asc" });
    s = nextSort(s, 2);
    expect(s).toEqual({ column: 2, dir: "desc" });
    expect(nextSort(s, 2)).toBeNull();
    expect(nextSort({ column: 1, dir: "desc" }, 2)).toEqual({ column: 2, dir: "asc" });
  });
});

describe("progress helpers", () => {
  it("counts checklist items across the guide", () => {
    const g = er as unknown as Guide;
    expect(guideCheckTotals(g, {})).toEqual({ done: 0, total: 5 });
    expect(guideCheckTotals(g, { [checkKey("route", "naga")]: true, "other:x": true })).toEqual({ done: 1, total: 5 });
  });
  it("clamps the saved section", () => {
    expect(clampSection(null, 4)).toBe(0);
    expect(clampSection(9, 4)).toBe(3);
    expect(clampSection(-2, 4)).toBe(0);
    expect(clampSection(2, 4)).toBe(2);
  });
});

describe("library", () => {
  const games = [
    { appid: 1, name: "Zelda-like" },
    { appid: 2, name: "Balatro" },
    { appid: 3, name: "Hollow Knight" },
    { appid: 4, name: "Celeste" },
  ];
  const guides = [meta("a", 2, "Balatro", "Mime + Baron", ["jokers"]), meta("b", 9, "Uninstalled Game", "Old run")];

  it("puts the running game first, then games with guides, then the rest", () => {
    const lib = buildLibrary(games, guides, 3);
    expect(lib.map((e) => e.name)).toEqual(["Hollow Knight", "Balatro", "Uninstalled Game", "Celeste", "Zelda-like"]);
    expect(lib[0].playing).toBe(true);
    expect(lib.find((e) => e.appid === 9)?.installed).toBe(false);
  });

  it("searches game names, guide titles and tags", () => {
    const lib = buildLibrary(games, guides, null);
    expect(filterLibrary(lib, "celes").map((e) => e.name)).toEqual(["Celeste"]);
    const byTag = filterLibrary(lib, "jokers");
    expect(byTag.map((e) => e.name)).toEqual(["Balatro"]);
    expect(byTag[0].matchedGuide).toBe(true);
    expect(filterLibrary(lib, "  ").length).toBe(lib.length);
    expect(filterLibrary(lib, "nothing here")).toEqual([]);
  });
});
