// Helpers for Steam's gamepad navigation tree.
import type { GamepadEvent } from "@decky/ui";

type Stoppable = { preventDefault?: () => void; stopPropagation?: () => void };

/** Marks a gamepad event as handled so Steam's navigation and router leave it alone. */
export function absorb(evt: GamepadEvent | undefined | null): true {
  const e = evt as unknown as (Stoppable & { detail?: { event?: Stoppable } }) | undefined;
  try {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    e?.detail?.event?.preventDefault?.();
    e?.detail?.event?.stopPropagation?.();
  } catch {
    /* ignore */
  }
  return true;
}

export function isRepeat(evt: GamepadEvent | undefined | null): boolean {
  return !!evt?.detail?.is_repeat;
}

type NavNode = { m_element?: HTMLElement; m_rgChildren?: NavNode[]; BTakeFocus?: (reason: number) => boolean };

function findNode(node: NavNode | undefined, target: HTMLElement): NavNode | null {
  if (!node) return null;
  if (node.m_element === target) return node;
  for (const child of node.m_rgChildren ?? []) {
    const hit = findNode(child, target);
    if (hit) return hit;
  }
  return null;
}

function takeNavTreeFocus(el: HTMLElement): boolean {
  try {
    const view = el.ownerDocument?.defaultView as any;
    const stores = [view?.opener?.SteamUIStore, view?.SteamUIStore, (globalThis as any).SteamUIStore];
    for (const store of stores) {
      const root = store?.NavigationManager?.m_ActiveContext?.m_LastActiveNavTree?.m_Root as NavNode | undefined;
      const node = root && findNode(root, el);
      if (node?.BTakeFocus) return !!node.BTakeFocus(0);
    }
  } catch {
    /* fall through */
  }
  return false;
}

/**
 * Moves gamepad focus to an element. Steam rebuilds its nav tree a frame or
 * two after React renders, so this retries for a few frames.
 */
export function focusElement(get: () => HTMLElement | null | undefined, attempts = 6) {
  let tries = 0;
  const step = () => {
    const el = get();
    if (el && el.isConnected) {
      if (takeNavTreeFocus(el)) return;
      try {
        el.focus();
      } catch {
        /* detached */
      }
      if (el.ownerDocument?.activeElement === el && tries > 1) return;
    }
    if (++tries < attempts) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

export function scrollIntoViewNearest(el: Element | null | undefined) {
  try {
    el?.scrollIntoView({ block: "nearest", inline: "nearest" });
  } catch {
    /* detached */
  }
}
