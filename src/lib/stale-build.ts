import { flushPendingSave } from "@/lib/persistence-debounce";
import { getSaveStatus } from "@/lib/save-status";

// -- Detection -----------------------------------------------------------------

async function isBuildStale(signal: AbortSignal): Promise<boolean> {
  const buildHash = window.__VITE_REACT_SSG_HASH__;
  if (!buildHash) return false;
  const manifestUrl = `${import.meta.env.BASE_URL}static-loader-data-manifest-${buildHash}.json`;
  const response = await fetch(manifestUrl, { method: "HEAD", cache: "no-store", signal });
  return !response.ok || !response.headers.get("Content-Type")?.includes("json");
}

async function isStaleBuildWithSavedWork(signal: AbortSignal): Promise<boolean> {
  if (!(await isBuildStale(signal))) return false;
  await flushPendingSave();
  return getSaveStatus() === "saved";
}

// -- Exports -------------------------------------------------------------------

export { isStaleBuildWithSavedWork };
