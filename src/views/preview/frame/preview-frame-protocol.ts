import type { Bounds } from "@/domain/word/bounds";

// -- Interfaces ----------------------------------------------------------------

interface FrameClock {
  time: number;
  playing: boolean;
  rate: number;
  // performance.timeOrigin + performance.now() when the clock was read, so the frame can run it forward.
  sentAt: number;
}

interface FrameKey {
  type: "keydown" | "keyup";
  key: string;
  code: string;
  location: number;
  repeat: boolean;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
}

type ToFrameMessage =
  | { kind: "connect" }
  | { kind: "lyrics"; ttml: string }
  | { kind: "focus"; range: Bounds | null }
  | { kind: "theme"; style: string; scheme: string | undefined }
  | { kind: "clock"; clock: FrameClock }
  | { kind: "stop" };

type FromFrameMessage =
  | { kind: "ready" }
  | { kind: "shown" }
  | { kind: "seek"; seconds: number }
  | { kind: "play" }
  | { kind: "pointerdown" }
  | { kind: "click" }
  | { kind: "release-focus" }
  | { kind: "key"; key: FrameKey };

// -- Constants -----------------------------------------------------------------

const PREVIEW_FRAME_PATH = "/preview-frame";
const PARENT_ORIGIN_PARAM = "parent";

// A cross-site origin serving the same deploy gets its own renderer process, so the
// preview's animation work leaves the Timeline's main thread. workers.dev is on the
// Public Suffix List, so it is a different site from betterlyrics.org.
const FRAME_ORIGIN_BY_APP_ORIGIN: Readonly<Record<string, string>> = {
  "https://composer.betterlyrics.org": "https://composer.boidushyabhattacharya.workers.dev",
};

// Branch previews: <alias>.dev.composer.betterlyrics.org is also served at <alias>-composer.<subdomain>.workers.dev.
const PREVIEW_DEPLOYMENT_HOST_SUFFIX = ".dev.composer.betterlyrics.org";
const PREVIEW_DEPLOYMENT_FRAME_HOST_SUFFIX = "-composer.boidushyabhattacharya.workers.dev";

const SWAPPED_LOCAL_HOSTS: Readonly<Record<string, string>> = { localhost: "127.0.0.1", "127.0.0.1": "localhost" };

// -- Functions -----------------------------------------------------------------

// localhost and 127.0.0.1 are different sites, so local builds isolate the same way.
function swappedLocalOrigin(origin: string): string | null {
  const url = new URL(origin);
  const swapped = SWAPPED_LOCAL_HOSTS[url.hostname];
  if (!swapped) return null;
  url.hostname = swapped;
  return url.origin;
}

function previewDeploymentFrameOrigin(origin: string): string | null {
  const { protocol, hostname } = new URL(origin);
  if (protocol !== "https:" || !hostname.endsWith(PREVIEW_DEPLOYMENT_HOST_SUFFIX)) return null;
  const alias = hostname.slice(0, -PREVIEW_DEPLOYMENT_HOST_SUFFIX.length);
  return alias && !alias.includes(".") ? `https://${alias}${PREVIEW_DEPLOYMENT_FRAME_HOST_SUFFIX}` : null;
}

function previewFrameOrigin(appOrigin: string): string | null {
  return (
    FRAME_ORIGIN_BY_APP_ORIGIN[appOrigin] ?? previewDeploymentFrameOrigin(appOrigin) ?? swappedLocalOrigin(appOrigin)
  );
}

function isAllowedParentOrigin(frameOrigin: string, parentOrigin: string): boolean {
  return previewFrameOrigin(parentOrigin) === frameOrigin;
}

function previewFrameUrl(frameOrigin: string, appOrigin: string): string {
  const url = new URL(PREVIEW_FRAME_PATH, frameOrigin);
  url.searchParams.set(PARENT_ORIGIN_PARAM, appOrigin);
  return url.href;
}

function parentOriginOf(frameUrl: string): string | null {
  return new URL(frameUrl).searchParams.get(PARENT_ORIGIN_PARAM);
}

function messageKind(data: unknown): string | null {
  if (typeof data !== "object" || data === null || !("kind" in data)) return null;
  return typeof data.kind === "string" ? data.kind : null;
}

// -- Exports -------------------------------------------------------------------

export { isAllowedParentOrigin, messageKind, parentOriginOf, previewFrameOrigin, previewFrameUrl };
export type { FrameClock, FrameKey, FromFrameMessage, ToFrameMessage };
