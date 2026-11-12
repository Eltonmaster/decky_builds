import { addEventListener, callable, removeEventListener } from "@decky/api";
import type { BackendApi, BackendEventSource } from "./types";
import type { Game, Guide, GuideMeta, Progress, ServerStatus, Upload } from "../types";

export const realApi: BackendApi = {
  get_server_status: callable<[], ServerStatus>("get_server_status"),
  start_server: callable<[number], ServerStatus>("start_server"),
  stop_server: callable<[], ServerStatus>("stop_server"),
  set_auto_stop: callable<[number], ServerStatus>("set_auto_stop"),
  list_installed_games: callable<[], Game[]>("list_installed_games"),
  list_guides: callable<[], GuideMeta[]>("list_guides"),
  get_guide: callable<[string], Guide>("get_guide"),
  rename_guide: callable<[string, string], GuideMeta>("rename_guide"),
  delete_guide: callable<[string], true>("delete_guide"),
  list_uploads: callable<[], Upload[]>("list_uploads"),
  get_progress: callable<[string], Progress>("get_progress"),
  set_check: callable<[string, string, boolean], Progress>("set_check"),
  set_last_section: callable<[string, number], Progress>("set_last_section"),
};

export const realEvents: BackendEventSource = {
  on(event, listener) {
    const registered = addEventListener(event, listener as (...a: unknown[]) => void);
    return () => removeEventListener(event, registered);
  },
};
