// Browser stand-ins for @decky/api. Preview only (the preview always uses the mock backend).
import { useEffect, useState } from "react";
export const callable = (name: string) => async () => { throw new Error(`${name}: no backend in preview`); };
export const addEventListener = (_e: string, l: any) => l;
export const removeEventListener = () => {};
export const definePlugin = (fn: any) => fn;
export const routerHook = { addRoute: () => {}, removeRoute: () => {} };
export const toaster = {
  toast: (t: { title: any; body: any }) => {
    const el = document.createElement("div");
    el.className = "sim-toast";
    el.innerHTML = `<b></b><span></span>`;
    el.querySelector("b")!.textContent = String(t.title);
    el.querySelector("span")!.textContent = String(t.body);
    document.querySelector("#screen")!.appendChild(el);
    setTimeout(() => el.remove(), 4000);
    return { data: t };
  },
};
export function useQuickAccessVisible() {
  const [v, setV] = useState(true);
  useEffect(() => { setV(true); }, []);
  return v;
}
