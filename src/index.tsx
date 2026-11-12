import { staticClasses } from "@decky/ui";
import { definePlugin, routerHook, toaster } from "@decky/api";
import { FaBookOpen } from "react-icons/fa";
import { LibraryRoute } from "./library/Library";
import { QuickAccess } from "./qam/QuickAccess";
import { connectBackendEvents, getState, guidesForApp, refreshGuides, refreshRunning, setState } from "./store";
import { GuideRoute, openGuide } from "./viewer/GuideViewer";

const LIBRARY_ROUTE = "/decky-builds/library";
const GUIDE_ROUTE = "/decky-builds/guide/:id";

/** When a game with a guide starts, say so and offer a one-tap way in. */
async function onAppStarted(appid: number) {
  // Steam's router takes a moment to report the new app as running.
  setTimeout(refreshRunning, 1500);
  let guides = getState().guides;
  if (!guides) {
    try {
      await refreshGuides();
      guides = getState().guides;
    } catch {
      return;
    }
  }
  const matches = guidesForApp(guides, appid);
  if (matches.length === 0) return;
  const first = matches[0];
  toaster.toast({
    title: matches.length === 1 ? "Guide ready" : `${matches.length} guides ready`,
    body: matches.length === 1 ? `${first.title} · open Decky Builds in Quick Access` : `For ${first.game_name} · open Decky Builds in Quick Access`,
    onClick: () => openGuide(first.id),
  });
}

export default definePlugin(() => {
  routerHook.addRoute(LIBRARY_ROUTE, LibraryRoute, { exact: true });
  routerHook.addRoute(GUIDE_ROUTE, GuideRoute, { exact: true });

  const disconnect = connectBackendEvents();
  refreshGuides().catch(() => {});
  refreshRunning();

  let lifetime: { unregister(): void } | undefined;
  try {
    lifetime = SteamClient.GameSessions.RegisterForAppLifetimeNotifications((n) => {
      if (n.bRunning) void onAppStarted(n.unAppID);
      else {
        setState({ running: null });
        setTimeout(refreshRunning, 500);
      }
    });
  } catch (e) {
    console.warn("[Decky Builds] could not watch for game launches", e);
  }

  return {
    name: "Decky Builds",
    titleView: <div className={staticClasses.Title}>Decky Builds</div>,
    content: <QuickAccess />,
    icon: <FaBookOpen />,
    onDismount() {
      lifetime?.unregister();
      disconnect();
      routerHook.removeRoute(LIBRARY_ROUTE);
      routerHook.removeRoute(GUIDE_ROUTE);
    },
  };
});
