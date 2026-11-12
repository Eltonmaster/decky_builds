import type { ButtonName } from "../types";

const WIDE = new Set(["L1", "R1", "L2", "R2", "L4", "R4", "L5", "R5", "START", "SELECT", "DPAD"]);
const LABEL: Partial<Record<ButtonName, string>> = { START: "☰", SELECT: "⧉", DPAD: "✛" };

/** A controller button drawn inline with text, like Steam's own glyphs. */
export function Glyph({ button }: { button: ButtonName }) {
  return (
    <span className={`dbx-glyph dbx-glyph-${button.toLowerCase()}${WIDE.has(button) ? " wide" : ""}`} title={button}>
      {LABEL[button] ?? button}
    </span>
  );
}
