import { realApi, realEvents } from "./backend";
import { createMockBackend } from "./mock";
import type { BackendApi, BackendEventSource } from "./types";

declare const __DECKY_BUILDS_MOCK__: boolean;

/** True when built with `pnpm build:mock`. */
export const IS_MOCK: boolean = typeof __DECKY_BUILDS_MOCK__ !== "undefined" && __DECKY_BUILDS_MOCK__;

const mock = IS_MOCK ? createMockBackend() : null;

export const api: BackendApi = mock ? mock.api : realApi;
export const events: BackendEventSource = mock ? mock.events : realEvents;

/** Turns an exception from a backend call into a short message for a toast. */
export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return "Unknown error";
  }
}
