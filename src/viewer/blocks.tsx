import { Focusable, GamepadButton, type GamepadEvent } from "@decky/ui";
import { forwardRef, type ReactNode } from "react";
import { RichText } from "../components/RichText";
import { absorb } from "../nav";
import type { CalloutBlock, ListBlock, Rich, StatsBlock } from "../types";

type StopProps = {
  className?: string;
  children: ReactNode;
  onActivate?(): void;
  okLabel?: string;
  onEdge?(button: number): boolean;
  onFocusStop(el: HTMLElement): void;
};

/** One focus stop in the reading view. The D-pad moves between stops. */
export const Stop = forwardRef<HTMLDivElement, StopProps>(function Stop(
  { className = "", children, onActivate, okLabel, onEdge, onFocusStop },
  ref,
) {
  return (
    <Focusable
      ref={ref}
      className={`dbx-blk ${className}`}
      focusClassName="dbx-focus"
      noFocusRing
      onActivate={onActivate ?? (() => {})}
      onOKActionDescription={okLabel ?? ""}
      onGamepadFocus={(evt: GamepadEvent) => onFocusStop(evt.currentTarget as HTMLElement)}
      onGamepadDirection={onEdge ? (evt: GamepadEvent) => (onEdge(evt.detail.button) ? absorb(evt) : false) : undefined}
    >
      {children}
    </Focusable>
  );
});

export function TextBody({ text }: { text: Rich }) {
  return (
    <p className="dbx-text">
      <RichText value={text} />
    </p>
  );
}

export function HeadingBody({ text }: { text: Rich }) {
  return (
    <div className="dbx-h">
      <RichText value={text} />
    </div>
  );
}

export function ListBody({ block }: { block: ListBlock }) {
  const items = block.items.map((item, i) => (
    <li key={i}>
      <RichText value={item} />
    </li>
  ));
  return block.style === "number" ? <ol className="dbx-list">{items}</ol> : <ul className="dbx-list">{items}</ul>;
}

export function StatsBody({ block }: { block: StatsBlock }) {
  return (
    <div className="dbx-stats">
      {block.items.map((it, i) => (
        <div key={i} className="dbx-st">
          <div className="dbx-st-l">{it.label}</div>
          <div className="dbx-st-v">{it.value}</div>
        </div>
      ))}
    </div>
  );
}

export function calloutClass(block: CalloutBlock) {
  return `dbx-call dbx-tone-${block.tone}`;
}

export function CalloutBody({ block }: { block: CalloutBlock }) {
  return (
    <>
      <div className="dbx-call-t">{block.title ?? toneLabel(block.tone)}</div>
      <div className="dbx-call-b">
        <RichText value={block.text} />
      </div>
    </>
  );
}

function toneLabel(tone: CalloutBlock["tone"]) {
  return tone === "tip" ? "Tip" : tone === "warning" ? "Warning" : "Note";
}

/** Down on the last stop / up on the first stop pages to the next / previous section. */
export function edgeHandler(opts: { first: boolean; last: boolean; onNext(): void; onPrev(): void }) {
  if (!opts.first && !opts.last) return undefined;
  return (button: number) => {
    if (opts.last && button === GamepadButton.DIR_DOWN) {
      opts.onNext();
      return true;
    }
    if (opts.first && button === GamepadButton.DIR_UP) {
      opts.onPrev();
      return true;
    }
    return false;
  };
}
