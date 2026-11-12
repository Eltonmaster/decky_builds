import { useEffect, useReducer, useState } from "react";
import { createRoot } from "react-dom/client";
import * as navSim from "./nav-sim";
import { bindNavSim } from "./decky-ui-stub";
import { LibraryRoute } from "../../src/library/Library";
import { GuideRoute } from "../../src/viewer/GuideViewer";
import { refreshRunning } from "../../src/store";

bindNavSim(navSim);

const GAMES = [
  { appid: 1245620, name: "ELDEN RING" },
  { appid: 413150, name: "Stardew Valley" },
  { appid: 367520, name: "Hollow Knight" },
];

// SteamClient stub: lets the preview "launch" a game.
let lifetimeCb: ((n: { unAppID: number; nInstanceID: number; bRunning: boolean }) => void) | null = null;
(window as any).SteamClient = {
  GameSessions: {
    RegisterForAppLifetimeNotifications(cb: any) { lifetimeCb = cb; return { unregister() {} }; },
  },
};
const qs = new URLSearchParams(location.search);
const startRunning = qs.get("running");
(window as any).__simRunning = startRunning === "none" ? null : GAMES.find((g) => String(g.appid) === startRunning) ?? GAMES[0];

// Plugin entry (definePlugin is the identity in the stub).
const pluginFactory = (await import("../../src/index")).default as unknown as () => { content: JSX.Element };
const plugin = pluginFactory();

function App() {
  const [path, setPath] = useState(qs.get("path") ?? "qam");
  const [history, setHistory] = useState<string[]>([]);
  const [, bump] = useReducer((x) => x + 1, 0);
  const [running, setRunning] = useState<any>((window as any).__simRunning);

  useEffect(() => {
    (window as any).__simNavigate = (p: string) => { setHistory((h) => [...h, path]); setPath(p); };
    (window as any).__simBack = () => setHistory((h) => { setPath(h[h.length - 1] ?? "qam"); return h.slice(0, -1); });
  });
  useEffect(() => navSim.onFocusChange(bump), []);
  useEffect(() => {
    const t = setInterval(bump, 300);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    navSim.installKeyboard(() => (window as any).__simBack());
  }, []);
  useEffect(() => {
    // Initial focus on the first leaf once a screen renders (Steam does this on open).
    navSim.setFocus(null);
    const t = setTimeout(() => {
      if (!navSim.getFocused()) {
        const first = document.querySelector<HTMLElement>("#screen [data-sim-leaf]");
        if (first) navSim.setFocus(first);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [path]);

  const guideMatch = path.match(/^\/decky-builds\/guide\/(.+)$/);
  if (guideMatch) (window as any).__simParams = { id: guideMatch[1] };

  const changeRunning = (appid: string) => {
    const g = GAMES.find((x) => String(x.appid) === appid) ?? null;
    (window as any).__simRunning = g;
    setRunning(g);
    if (g) lifetimeCb?.({ unAppID: g.appid, nInstanceID: 1, bRunning: true });
    else lifetimeCb?.({ unAppID: 0, nInstanceID: 1, bRunning: false });
    refreshRunning();
  };

  return (
    <div className="sim-wrap">
      <div className="sim-bar">
        <button onClick={() => { setHistory([]); setPath("qam"); }}>Quick Access</button>
        <button onClick={() => { setHistory(["qam"]); setPath("/decky-builds/library"); }}>Library</button>
        <button onClick={() => { setHistory(["qam"]); setPath("/decky-builds/guide/er-bleed-samurai"); }}>Guide</button>
        <label>
          Running game{" "}
          <select value={running ? String(running.appid) : "none"} onChange={(e) => changeRunning(e.target.value)}>
            {GAMES.map((g) => <option key={g.appid} value={g.appid}>{g.name}</option>)}
            <option value="none">Nothing running</option>
          </select>
        </label>
        <span className="sim-keys">Arrows D-pad · Enter A · Esc B · X · Y · Q L1 · E R1</span>
      </div>
      <div id="screen" className="sim-screen">
        {path === "qam" ? (
          <>
            <div className="sim-gamebg">
              <div className="sim-gb-title">{running?.name ?? "Steam"}</div>
            </div>
            <div className="sim-qam">
              <div className="sim-qam-rail"><b /><b /><b className="cur" /></div>
              <div className="sim-qam-panel">
                <div className="sim-qam-head"><span>Decky Builds</span><span className="sim-ver">0.1.0</span></div>
                {plugin.content}
              </div>
            </div>
          </>
        ) : path === "/decky-builds/library" ? (
          <LibraryRoute />
        ) : guideMatch ? (
          <GuideRoute />
        ) : (
          <div>Unknown route {path}</div>
        )}
        <div className="sim-steamhead">
          <span>{new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
        </div>
        <div className="sim-legend">
          {navSim.legendFor().map((l) => (
            <span key={l.button}><i className={`sim-g sim-g-${l.button.toLowerCase()}`}>{l.button}</i>{l.label}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
