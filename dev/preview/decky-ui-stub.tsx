// Browser stand-ins for the @decky/ui pieces the plugin uses. Preview only.
import { forwardRef, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";

export enum GamepadButton {
  INVALID = 0, OK = 1, CANCEL = 2, SECONDARY = 3, OPTIONS = 4, BUMPER_LEFT = 5, BUMPER_RIGHT = 6,
  TRIGGER_LEFT = 7, TRIGGER_RIGHT = 8, DIR_UP = 9, DIR_DOWN = 10, DIR_LEFT = 11, DIR_RIGHT = 12,
}
export type GamepadEvent = CustomEvent<{ button: number; is_repeat?: boolean; source: number }>;
export const staticClasses = { Title: "sim-title" };

// Lazy import to avoid a cycle with nav-sim.
let navSim: typeof import("./nav-sim") | null = null;
export function bindNavSim(m: typeof import("./nav-sim")) { navSim = m; }

const HANDLER_KEYS = [
  "onActivate", "onOKButton", "onCancelButton", "onSecondaryButton", "onOptionsButton", "onButtonDown",
  "onGamepadDirection", "onGamepadFocus", "onGamepadBlur", "actionDescriptionMap", "onOKActionDescription",
  "onCancelActionDescription", "onSecondaryActionDescription", "onOptionsActionDescription", "focusClassName", "noFocusRing",
];

export const Focusable = forwardRef<HTMLDivElement, any>(function Focusable(props, ref) {
  const { children, className, style } = props;
  const elRef = useRef<HTMLDivElement | null>(null);
  const handlers: Record<string, any> = {};
  for (const k of HANDLER_KEYS) if (props[k] !== undefined) handlers[k] = props[k];
  const setRef = useCallback((el: HTMLDivElement | null) => {
    elRef.current = el;
    if (typeof ref === "function") ref(el);
    else if (ref) (ref as any).current = el;
  }, [ref]);
  useEffect(() => {
    if (elRef.current) navSim?.handlerMap.set(elRef.current, handlers);
  });
  const leaf = !!props.onActivate;
  return (
    <div ref={setRef} className={className} style={style} tabIndex={leaf ? -1 : undefined} {...(leaf ? { "data-sim-leaf": "" } : {})}
      onClick={leaf ? () => props.onActivate?.({ detail: { button: 1 } }) : undefined}>
      {children}
    </div>
  );
});

export const Navigation = {
  Navigate: (path: string) => (window as any).__simNavigate(path),
  NavigateBack: () => (window as any).__simBack(),
  CloseSideMenus: () => {},
};
export const Router = {
  get MainRunningApp() {
    const r = (window as any).__simRunning;
    return r ? { appid: String(r.appid), display_name: r.name, display_status: 0, sort_as: r.name } : undefined;
  },
};

export function useParams<T>(): T {
  return (window as any).__simParams as T;
}

export function PanelSection({ title, children }: { title?: string; children?: ReactNode }) {
  return (
    <div className="sim-psec">
      {title && <div className="sim-psec-t">{title}</div>}
      {children}
    </div>
  );
}
export function PanelSectionRow({ children }: { children?: ReactNode }) {
  return <div className="sim-prow">{children}</div>;
}
export function ButtonItem({ children, onClick, disabled }: any) {
  return <Focusable className="sim-btn" onActivate={disabled ? undefined : onClick} focusClassName="sim-f">{children}</Focusable>;
}
export function ToggleField({ label, description, checked, onChange, disabled }: any) {
  return (
    <Focusable className="sim-field" focusClassName="sim-f" onActivate={() => !disabled && onChange?.(!checked)}>
      <div style={{ flex: 1 }}>
        <div className="sim-field-l">{label}</div>
        {description && <div className="sim-field-d">{description}</div>}
      </div>
      <span className={`sim-switch${checked ? " on" : ""}`}><i /></span>
    </Focusable>
  );
}
export function DropdownItem({ label, rgOptions, selectedOption, onChange, disabled }: any) {
  const idx = rgOptions.findIndex((o: any) => o.data === selectedOption);
  return (
    <Focusable className="sim-field" focusClassName="sim-f"
      onActivate={() => !disabled && onChange?.(rgOptions[(idx + 1) % rgOptions.length])}>
      <div style={{ flex: 1 }} className="sim-field-l">{label}</div>
      <span className="sim-val">{rgOptions[idx]?.label} ▾</span>
    </Focusable>
  );
}
export function TextField({ label, value, onChange, placeholder, focusOnMount }: any) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (focusOnMount) setTimeout(() => ref.current?.focus(), 50); }, []);
  return (
    <label className="sim-text">
      {label && <div className="sim-field-d">{label}</div>}
      <input ref={ref} data-sim-leaf="" value={value} onChange={onChange} placeholder={placeholder ?? "Search games, guides and tags"} />
    </label>
  );
}

// ---- modals and menus ----
let layerRoot: Root | null = null;
const stack: ReactNode[] = [];
function renderLayer() {
  let el = document.querySelector("#sim-modal-layer") as HTMLElement | null;
  if (!el) {
    el = document.createElement("div");
    el.id = "sim-modal-layer";
    el.className = "sim-modal-layer";
    document.querySelector("#screen")!.appendChild(el);
  }
  if (!layerRoot) layerRoot = createRoot(el);
  layerRoot.render(stack.length ? <div className="sim-modal-bg">{stack[stack.length - 1]}</div> : null);
  setTimeout(() => {
    const first = el.querySelector<HTMLElement>("input[data-sim-leaf], [data-sim-leaf]");
    if (first) navSim?.setFocus(first);
    else (window as any).__simRestoreFocus?.();
  }, 30);
}
function push(node: (close: () => void) => ReactNode) {
  const close = () => { stack.pop(); if (menuClosing) keepRestore = true; renderLayer(); };
  stack.push(node(close));
  renderLayer();
  return { Close: close, Hide: close, Show: () => {}, Update: () => {} };
}
let menuClosing = false;
let keepRestore = false;
function rememberFocus() {
  if (stack.length || keepRestore) { keepRestore = false; return; }
  const prev = navSim?.getFocused();
  (window as any).__simRestoreFocus = () => prev && navSim?.setFocus(prev);
}
export function showModal(modal: any) {
  rememberFocus();
  return push((close) => <ModalHost close={close} modal={modal} />);
}
function ModalHost({ modal, close }: any) {
  return { ...modal, props: { ...modal.props, closeModal: close } };
}
export function showContextMenu(children: any) {
  rememberFocus();
  let closeFn = () => {};
  const res = push((close) => { closeFn = close; return <MenuCtx.Provider value={close}>{children}</MenuCtx.Provider>; });
  void closeFn;
  return res;
}
import { createContext, useContext } from "react";
const MenuCtx = createContext<() => void>(() => {});
export function Menu({ label, children }: any) {
  const close = useContext(MenuCtx);
  return (
    <Focusable className="sim-menu" onCancelButton={() => (close(), true)}>
      <div className="sim-menu-t">{label}</div>
      {children}
    </Focusable>
  );
}
export function MenuItem({ children, onClick, tone }: any) {
  const close = useContext(MenuCtx);
  return (
    <Focusable className={`sim-menu-i${tone === "destructive" ? " bad" : ""}`} focusClassName="sim-f"
      onActivate={() => { menuClosing = true; close(); menuClosing = false; setTimeout(() => onClick?.(), 0); }}>{children}</Focusable>
  );
}
export function ConfirmModal({ strTitle, strDescription, strOKButtonText = "Confirm", strCancelButtonText = "Cancel", onOK, onCancel, closeModal, bOKDisabled, bDestructiveWarning, children }: any) {
  const [, force] = useState(0);
  void force;
  return (
    <Focusable className="sim-modal" onCancelButton={() => { onCancel?.(); closeModal?.(); return true; }}>
      <div className="sim-modal-t">{strTitle}</div>
      {strDescription && <div className="sim-modal-d">{strDescription}</div>}
      {children}
      <div className="sim-modal-btns">
        <Focusable className={`sim-btn${bDestructiveWarning ? " bad" : ""}${bOKDisabled ? " dis" : ""}`} focusClassName="sim-f"
          onActivate={async () => { if (bOKDisabled) return; await onOK?.(); if (!children) closeModal?.(); }}>{strOKButtonText}</Focusable>
        <Focusable className="sim-btn" focusClassName="sim-f" onActivate={() => { onCancel?.(); closeModal?.(); }}>{strCancelButtonText}</Focusable>
      </div>
    </Focusable>
  );
}
