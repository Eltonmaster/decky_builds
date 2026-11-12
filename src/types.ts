// Types shared with the Python backend. Source of truth: docs/contract.md (v1).

export type AutoStopMinutes = 15 | 30 | 60 | 0;

export type ServerStatus = {
  running: boolean;
  url: string | null;
  port: number | null;
  pairing_code: string | null;
  auto_stop_minutes: AutoStopMinutes;
  stops_at: number | null;
};

export type Game = { appid: number; name: string };

export type GuideMeta = {
  id: string;
  title: string;
  appid: number;
  game_name: string;
  author: string | null;
  updated: string | null;
  tags: string[];
  summary: string | null;
  section_count: number;
  received_at: number;
};

export type Upload = {
  file: string;
  received_at: number;
  ok: boolean;
  guide_id: string | null;
  error: string | null;
};

export type Progress = { checks: Record<string, boolean>; last_section: number | null };

// ---- Guide format v1 ----

export type ButtonName =
  | "A" | "B" | "X" | "Y" | "L1" | "R1" | "L2" | "R2"
  | "L4" | "R4" | "L5" | "R5" | "START" | "SELECT" | "DPAD";

export type Span =
  | { b: string }
  | { i: string }
  | { hl: string }
  | { btn: ButtonName };

export type Rich = string | Span | Array<string | Span>;

export type Align = "left" | "right" | "center";

export type TextBlock = { type: "text"; text: Rich };
export type HeadingBlock = { type: "heading"; text: Rich };
export type ListBlock = { type: "list"; style?: "bullet" | "number"; items: Rich[] };
export type ChecklistBlock = { type: "checklist"; id: string; items: { id: string; text: Rich }[] };
export type TableCell = string | number | Rich;
export type TableBlock = {
  type: "table";
  caption?: string;
  columns: { label: string; align?: Align }[];
  rows: TableCell[][];
  stickyFirstColumn?: boolean;
};
export type StatsBlock = { type: "stats"; items: { label: string; value: string | number }[] };
export type CalloutBlock = { type: "callout"; tone: "tip" | "warning" | "note"; title?: string; text: Rich };

export type Block =
  | TextBlock | HeadingBlock | ListBlock | ChecklistBlock
  | TableBlock | StatsBlock | CalloutBlock;

export type Section = { id: string; title: string; blocks: Block[] };

export type Guide = {
  format: "decky-builds.guide";
  version: 1;
  id: string;
  title: string;
  game: { appid: number; name: string };
  author?: string;
  updated?: string;
  tags?: string[];
  summary?: string;
  sections: Section[];
};
