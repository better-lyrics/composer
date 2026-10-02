import type { StorageEstimateBytes } from "@/domain/storage/space";

// -- Types --------------------------------------------------------------------

type StorageProtection = "protected" | "unprotected" | "unsupported";

// -- Constants ----------------------------------------------------------------

const LOG_PREFIX = "[BrowserStorage]";

// -- Helpers ------------------------------------------------------------------

function storageManager(): StorageManager | undefined {
  return typeof navigator === "undefined" ? undefined : navigator.storage;
}

// -- Reads --------------------------------------------------------------------

async function readStorageEstimate(): Promise<StorageEstimateBytes | undefined> {
  const manager = storageManager();
  if (!manager || typeof manager.estimate !== "function") return undefined;
  const { usage, quota } = await manager.estimate();
  return usage === undefined || quota === undefined ? undefined : { usage, quota };
}

async function readStorageProtection(): Promise<StorageProtection> {
  const manager = storageManager();
  if (!manager || typeof manager.persisted !== "function" || typeof manager.persist !== "function") {
    return "unsupported";
  }
  return (await manager.persisted()) ? "protected" : "unprotected";
}

// -- Protection ---------------------------------------------------------------

async function requestStorageProtection(): Promise<StorageProtection> {
  const manager = storageManager();
  if (!manager || typeof manager.persist !== "function") return "unsupported";
  return (await manager.persist()) ? "protected" : "unprotected";
}

function protectStorageForFirstProject(): void {
  requestStorageProtection().catch((error: unknown) => {
    console.error(LOG_PREFIX, "could not ask the browser to protect storage", error);
  });
}

// -- Exports ------------------------------------------------------------------

export { readStorageEstimate, readStorageProtection, requestStorageProtection, protectStorageForFirstProject };
export type { StorageProtection };
