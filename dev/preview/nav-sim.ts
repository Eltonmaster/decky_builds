// A tiny stand-in for Steam's gamepad navigation, for the browser preview only.
// Keyboard: arrows = D-pad, Enter = A, Esc/Backspace = B, X = X, Y = Y, Q = L1, E = R1.
import { GamepadButton } from "./decky-ui-stub";

type Handlers = Record<string, any>;
export const handlerMap = new WeakMap<HTMLElement, Handlers>();
let current: HTMLElement | null = null;
const listeners = new Set<() => void>();
export const onFocusChange = (fn: () => void) => (listeners.add(fn), () => listeners.delete(fn));
export const getFocused = () => current;

function makeEvt(el: HTMLElement, button: number) {
  let prevented = false;
  return {
    evt: {
      detail: { button, is_repeat: false, source: 0 },
      currentTarget: el,
      target: el,
      preventDefault() { prevented = true; },
      stopPropagation() {},
    },
    prevented: () => prevented,
  };
}

function chain(el: HTMLElement | null): HTMLElement[] {
  const out: HTMLElement[] = [];
  for (let n = el; n; n = n.parentElement) if (handlerMap.has(n)) out.push(n);
  return out;
}

/** Calls `name` on the focused element and its Focusable ancestors until one handles it. */
function fire(name: string, button: number): boolean {
  for (const el of chain(current)) {
    const h = handlerMap.get(el)![name];
    if (!h) continue;
    const { evt, prevented } = makeEvt(el, button);
    const r = h(evt);
    if (r === true || prevented() || (r === undefined && name !== "onButtonDown" && name !== "onGamepadDirection")) return true;
  }
  return false;
}

export function setFocus(el: HTMLElement | null) {
  if (el === current) return;
  const prev = current;
  if (prev) {
    const h = handlerMap.get(prev);
    if (h?.focusClassName) prev.classList.remove(h.focusClassName);
    prev.classList.remove("sim-focus");
    h?.onGamepadBlur?.(makeEvt(prev, 0).evt);
  }
  current = el;
  if (el) {
    const h = handlerMap.get(el);
    el.classList.add(h?.focusClassName ?? "sim-focus");
    if (!h?.noFocusRing) el.classList.add("sim-focus");
    h?.onGamepadFocus?.(makeEvt(el, 0).evt);
    if (document.activeElement !== el && !el.contains(document.activeElement)) el.focus({ preventScroll: true });
    el.scrollIntoView({ block: "nearest" });
  }
  listeners.forEach((l) => l());
}

function leaves(): HTMLElement[] {
  const layer = document.querySelector(".sim-modal-layer:not(:empty)") ?? document.querySelector("#screen");
  return [...(layer?.querySelectorAll<HTMLElement>("[data-sim-leaf]") ?? [])].filter((el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  });
}

function move(button: number) {
  const all = leaves();
  if (!current || !all.includes(current)) return setFocus(all[0] ?? null);
  const a = current.getBoundingClientRect();
  const ax = a.left + a.width / 2, ay = a.top + a.height / 2;
  let best: HTMLElement | null = null, bestScore = Infinity;
  for (const el of all) {
    if (el === current) continue;
    const b = el.getBoundingClientRect();
    const bx = b.left + b.width / 2, by = b.top + b.height / 2;
    let main: number, cross: number;
    switch (button) {
      case GamepadButton.DIR_DOWN: main = b.top - a.bottom + 1; cross = Math.abs(bx - ax); if (by <= ay) continue; break;
      case GamepadButton.DIR_UP: main = a.top - b.bottom + 1; cross = Math.abs(bx - ax); if (by >= ay) continue; break;
      case GamepadButton.DIR_RIGHT: main = b.left - a.right + 1; cross = Math.abs(by - ay); if (bx <= ax || b.left < a.right - 4) continue; break;
      default: main = a.left - b.right + 1; cross = Math.abs(by - ay); if (bx >= ax || b.right > a.left + 4) continue;
    }
    const score = Math.max(0, main) * 1 + cross * 2;
    if (score < bestScore) { bestScore = score; best = el; }
  }
  if (best) setFocus(best);
}

export function installKeyboard(onBack: () => void) {
  document.addEventListener("focusin", (e) => {
    const t = e.target as HTMLElement;
    const leaf = t.closest?.("[data-sim-leaf]") as HTMLElement | null;
    if (leaf && leaf !== current) setFocus(leaf);
  });
  document.addEventListener("keydown", (e) => {
    const typing = (document.activeElement as HTMLElement)?.tagName === "INPUT";
    const dir: Record<string, number> = { ArrowUp: GamepadButton.DIR_UP, ArrowDown: GamepadButton.DIR_DOWN, ArrowLeft: GamepadButton.DIR_LEFT, ArrowRight: GamepadButton.DIR_RIGHT };
    if (typing && !["ArrowUp", "ArrowDown", "Escape", "Enter"].includes(e.key)) return;
    if (dir[e.key] != null) {
      e.preventDefault();
      if (!fire("onGamepadDirection", dir[e.key])) move(dir[e.key]);
      return;
    }
    const k = e.key.toLowerCase();
    if (k === "enter") {
      e.preventDefault();
      if (typing) return (document.activeElement as HTMLElement).blur();
      const h = current && handlerMap.get(current);
      if (h?.onActivate) h.onActivate(makeEvt(current!, GamepadButton.OK).evt);
      else fire("onOKButton", GamepadButton.OK);
    } else if (k === "escape" || k === "backspace") {
      e.preventDefault();
      if (!fire("onCancelButton", GamepadButton.CANCEL)) onBack();
    } else if (k === "x") fire("onSecondaryButton", GamepadButton.SECONDARY);
    else if (k === "y") fire("onOptionsButton", GamepadButton.OPTIONS);
    else if (k === "q") fire("onButtonDown", GamepadButton.BUMPER_LEFT);
    else if (k === "e") fire("onButtonDown", GamepadButton.BUMPER_RIGHT);
  });
}

/** Footer labels for the focused element and its ancestors, nearest first. */
export function legendFor(): { button: string; label: string }[] {
  const names: Record<number, string> = { 1: "A", 2: "B", 3: "X", 4: "Y", 5: "L1", 6: "R1" };
  const seen = new Map<string, string>();
  for (const el of chain(current)) {
    const h = handlerMap.get(el)!;
    const add = (b: number, label: any) => {
      const n = names[b];
      if (n && label && !seen.has(n)) seen.set(n, String(label));
    };
    if (h.onOKActionDescription !== undefined) add(1, h.onOKActionDescription);
    if (h.onCancelActionDescription !== undefined) add(2, h.onCancelActionDescription);
    if (h.onSecondaryActionDescription !== undefined) add(3, h.onSecondaryActionDescription);
    if (h.onOptionsActionDescription !== undefined) add(4, h.onOptionsActionDescription);
    for (const [b, label] of Object.entries(h.actionDescriptionMap ?? {})) add(Number(b), label);
  }
  if (!seen.has("B")) seen.set("B", "Back");
  return ["L1", "R1", "Y", "X", "B", "A"].filter((b) => seen.has(b) && seen.get(b)).map((b) => ({ button: b, label: seen.get(b)! }));
}
