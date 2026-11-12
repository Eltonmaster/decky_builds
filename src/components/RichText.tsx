import { Fragment } from "react";
import type { Rich, Span, TableCell } from "../types";
import { Glyph } from "./Glyph";

function SpanView({ span }: { span: Span }) {
  if ("b" in span) return <strong>{span.b}</strong>;
  if ("i" in span) return <em>{span.i}</em>;
  if ("hl" in span) return <mark className="dbx-mark">{span.hl}</mark>;
  if ("btn" in span) return <Glyph button={span.btn} />;
  return null;
}

/** Renders the guide format's rich text: a string, a span, or a list of both. */
export function RichText({ value }: { value: Rich | TableCell | null | undefined }) {
  if (value == null) return null;
  if (typeof value === "string" || typeof value === "number") return <>{value}</>;
  if (Array.isArray(value)) {
    return (
      <>
        {value.map((part, i) => (
          <Fragment key={i}>{typeof part === "string" ? part : <SpanView span={part} />}</Fragment>
        ))}
      </>
    );
  }
  return <SpanView span={value} />;
}
