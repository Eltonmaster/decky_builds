import {
  ButtonItem, DropdownItem, Focusable, Navigation, PanelSection, PanelSectionRow, ToggleField,
} from "@decky/ui";
import { toaster, useQuickAccessVisible } from "@decky/api";
import { useEffect, useState } from "react";
import { api, errorMessage, IS_MOCK } from "../api";
import { Cover } from "../components/Cover";
import { Styles } from "../components/Styles";
import { guidesForApp, refreshGuides, refreshRunning, refreshStatus, setState, useStore } from "../store";
import type { AutoStopMinutes, GuideMeta, ServerStatus, Upload } from "../types";
import { openGuide } from "../viewer/GuideViewer";

const AUTO_STOP: { data: AutoStopMinutes; label: string }[] = [
  { data: 15, label: "15 minutes" },
  { data: 30, label: "30 minutes" },
  { data: 60, label: "1 hour" },
  { data: 0, label: "Never" },
];

export function openLibrary() {
  Navigation.Navigate("/decky-builds/library");
  Navigation.CloseSideMenus();
}

export function QuickAccess() {
  const visible = useQuickAccessVisible();
  const status = useStore((s) => s.status);
  const guides = useStore((s) => s.guides);
  const uploads = useStore((s) => s.uploads);
  const running = useStore((s) => s.running);

  // Refresh whenever the panel opens; events keep it current while open.
  useEffect(() => {
    if (!visible) return;
    refreshRunning();
    refreshStatus().catch((e) => toaster.toast({ title: "Decky Builds", body: errorMessage(e) }));
    refreshGuides().catch(() => {});
  }, [visible]);

  const runningGuides = guidesForApp(guides, running?.appid);

  return (
    <div className="dbx-root">
      <Styles />
      {running && <NowPlaying name={running.name} appid={running.appid} guides={runningGuides} />}
      <PanelSection title="Library">
        <PanelSectionRow>
          <ButtonItem layout="below" onClick={openLibrary}>
            Open library{guides ? ` (${guides.length} guide${guides.length === 1 ? "" : "s"})` : ""}
          </ButtonItem>
        </PanelSectionRow>
      </PanelSection>
      <UploadSection status={status} />
      {uploads.length > 0 && <RecentUploads uploads={uploads} />}
      {IS_MOCK && (
        <PanelSection>
          <div className="dbx-meta">Mock build: data is simulated.</div>
        </PanelSection>
      )}
    </div>
  );
}

function NowPlaying({ name, appid, guides }: { name: string; appid: number; guides: GuideMeta[] }) {
  return (
    <PanelSection>
      <div className="dbx-now">
        <div className="dbx-now-h">
          <Cover appid={appid} name={name} />
          <div>
            <div className="dbx-now-k">Now playing</div>
            <div className="dbx-now-n">{name}</div>
          </div>
        </div>
        {guides.length === 0 ? (
          <div className="dbx-now-empty">No guide for this game yet. Turn on uploads below to add one.</div>
        ) : (
          <Focusable flow-children="column" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {guides.map((g) => (
              <Focusable
                key={g.id}
                className="dbx-nowg"
                focusClassName="dbx-focus"
                noFocusRing
                onActivate={() => openGuide(g.id)}
                onOKActionDescription="Open guide"
              >
                <div className="dbx-nowg-main">
                  <div className="dbx-nowg-t">{g.title}</div>
                  <div className="dbx-nowg-s">
                    {g.section_count} section{g.section_count === 1 ? "" : "s"}
                    {g.tags.length ? ` · ${g.tags.slice(0, 3).join(", ")}` : ""}
                  </div>
                </div>
                <div className="dbx-nowg-go">Open ›</div>
              </Focusable>
            ))}
          </Focusable>
        )}
      </div>
    </PanelSection>
  );
}

function useCountdown(stopsAt: number | null) {
  const [now, setNow] = useState(() => Date.now() / 1000);
  useEffect(() => {
    if (!stopsAt) return;
    const t = setInterval(() => setNow(Date.now() / 1000), 1000);
    return () => clearInterval(t);
  }, [stopsAt]);
  if (!stopsAt) return null;
  const left = Math.max(0, Math.round(stopsAt - now));
  return `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;
}

function UploadSection({ status }: { status: ServerStatus | null }) {
  const [busy, setBusy] = useState(false);
  const countdown = useCountdown(status?.running ? status.stops_at : null);
  const running = !!status?.running;
  const autoStop = status?.auto_stop_minutes ?? 15;

  const run = async (fn: () => Promise<ServerStatus>) => {
    setBusy(true);
    try {
      setState({ status: await fn() });
    } catch (e) {
      toaster.toast({ title: "Upload server", body: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <PanelSection title="Uploads">
      <PanelSectionRow>
        <ToggleField
          label="Accept file uploads"
          description={running ? "Open the address below in a browser on the same network." : "Off until you turn it on."}
          checked={running}
          disabled={busy || !status}
          onChange={(on) => run(() => (on ? api.start_server(autoStop) : api.stop_server()))}
        />
      </PanelSectionRow>
      {running && status && (
        <PanelSectionRow>
          <div className="dbx-srv">
            <div className="dbx-srv-url">{status.url}</div>
            <div>
              <div className="dbx-srv-k">Pairing code</div>
              <div className="dbx-srv-code">{status.pairing_code}</div>
            </div>
            <div className="dbx-srv-timer">
              <span className="dbx-dot" />
              {countdown ? `Stops in ${countdown}` : "Running"}
            </div>
          </div>
        </PanelSectionRow>
      )}
      <PanelSectionRow>
        <DropdownItem
          label="Auto-stop after"
          rgOptions={AUTO_STOP}
          selectedOption={autoStop}
          disabled={busy || !status}
          onChange={(opt) => {
            const minutes = opt.data as AutoStopMinutes;
            run(() => api.set_auto_stop(minutes));
          }}
        />
      </PanelSectionRow>
    </PanelSection>
  );
}

function timeAgo(ts: number) {
  const s = Math.max(0, Math.round(Date.now() / 1000 - ts));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
}

function RecentUploads({ uploads }: { uploads: Upload[] }) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <PanelSection title="Recent uploads">
      <Focusable flow-children="column">
        {uploads.slice(0, 6).map((u, i) => (
          <PanelSectionRow key={`${u.received_at}-${u.file}-${i}`}>
            <Focusable
              className="dbx-up"
              focusClassName="dbx-focus"
              noFocusRing
              onActivate={() => {
                if (u.ok && u.guide_id) openGuide(u.guide_id);
                else setOpen((o) => (o === i ? null : i));
              }}
              onOKActionDescription={u.ok ? "Open guide" : open === i ? "Hide error" : "Show error"}
            >
              <span className={`dbx-up-ic ${u.ok ? "ok" : "err"}`}>{u.ok ? "✓" : "!"}</span>
              <div className="dbx-up-main">
                <div className="dbx-up-name">{u.file}</div>
                <div className="dbx-up-sub">
                  {u.ok ? "Saved" : "Rejected"} · {timeAgo(u.received_at)}
                </div>
                {!u.ok && open === i && u.error && <div className="dbx-up-err">{u.error}</div>}
              </div>
            </Focusable>
          </PanelSectionRow>
        ))}
      </Focusable>
    </PanelSection>
  );
}
