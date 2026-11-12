import type { Rich, Span, TableCell } from "./types";

/** Flattens rich text to a plain string (for search, sorting and labels). */
export function plainText(rich: Rich | TableCell | null | undefined): string {
  if (rich == null) return "";
  if (typeof rich === "number") return String(rich);
  if (typeof rich === "string") return rich;
  if (Array.isArray(rich)) return rich.map((p) => plainText(p)).join("");
  return spanText(rich);
}

export function spanText(span: Span): string {
  if ("b" in span) return span.b;
  if ("i" in span) return span.i;
  if ("hl" in span) return span.hl;
  if ("btn" in span) return span.btn;
  return "";
}
