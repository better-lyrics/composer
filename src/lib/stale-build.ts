import { flushPendingSave } from "@/lib/persistence-debounce";
import { getSaveStatus } from "@/lib/save-status";

// -- Constants -----------------------------------------------------------------

const STALE_CHECK_TIMEOUT_MS = 5000;

// -- Detection -----------------------------------------------------------------

async function isBuildStale(signal: AbortSignal): Promise<boolean> {
  const buildHash = window.__VITE_REACT_SSG_HASH__;
  if (!buildHash) return false;
  const manifestUrl = `${import.meta.env.BASE_URL}static-loader-data-manifest-${buildHash}.json`;
  const response = await fetch(manifestUrl, { method: "HEAD", cache: "no-store", signal });
  return !response.ok || (response.headers.get("Content-Type") ?? "").includes("text/html");
}

async function checkStaleBuildWithSavedWork(signal: AbortSignal): Promise<boolean> {
  if (!(await isBuildStale(signal))) return false;
  await flushPendingSave();
  return getSaveStatus() === "saved";
}

function isStaleBuildWithSavedWork(signal: AbortSignal): Promise<boolean> {
  const timedOut = new Promise<boolean>((resolve) => setTimeout(() => resolve(false), STALE_CHECK_TIMEOUT_MS));
  return Promise.race([checkStaleBuildWithSavedWork(signal), timedOut]);
}

// -- Exports -------------------------------------------------------------------

export { isStaleBuildWithSavedWork };
