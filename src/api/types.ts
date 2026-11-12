import type { Game, Guide, GuideMeta, Progress, ServerStatus, Upload } from "../types";

/** Every backend method from the contract, with the same names and arguments. */
export interface BackendApi {
  get_server_status(): Promise<ServerStatus>;
  start_server(auto_stop_minutes: number): Promise<ServerStatus>;
  stop_server(): Promise<ServerStatus>;
  set_auto_stop(minutes: number): Promise<ServerStatus>;
  list_installed_games(): Promise<Game[]>;
  list_guides(): Promise<GuideMeta[]>;
  get_guide(guide_id: string): Promise<Guide>;
  rename_guide(guide_id: string, title: string): Promise<GuideMeta>;
  delete_guide(guide_id: string): Promise<true>;
  list_uploads(): Promise<Upload[]>;
  get_progress(guide_id: string): Promise<Progress>;
  set_check(guide_id: string, key: string, value: boolean): Promise<Progress>;
  set_last_section(guide_id: string, index: number): Promise<Progress>;
}

export type BackendEvents = {
  server_status: [ServerStatus];
  upload_received: [Upload];
  guides_changed: [GuideMeta[]];
};

export type EventName = keyof BackendEvents;

export interface BackendEventSource {
  on<E extends EventName>(event: E, listener: (...args: BackendEvents[E]) => void): () => void;
}
