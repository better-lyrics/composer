import type { AlignedLineRecord, ProjectTelemetry } from "@/domain/alignment/telemetry";
import { ALIGNMENT_TELEMETRY_STORE_NAME, getFromStore, runTransaction, setInStore } from "@/lib/persistence-idb";

// Alignment telemetry on this device, one record per project id. It sits in
// its own store, never in the saved project, so it doesn't travel inside
// project files and one clear removes it for every project. Deleting a project
// deletes its record with the rest of the project's data.

// -- Functions ----------------------------------------------------------------

function readProjectTelemetry(projectId: string): Promise<ProjectTelemetry | undefined> {
  return getFromStore<ProjectTelemetry>(ALIGNMENT_TELEMETRY_STORE_NAME, projectId);
}

/** Adds or replaces these lines in the project's record, in one transaction so runs can't drop each other's lines. */
function recordAlignedLines(projectId: string, lines: readonly AlignedLineRecord[]): Promise<void> {
  return runTransaction([ALIGNMENT_TELEMETRY_STORE_NAME], "readwrite", (tx) => {
    const store = tx.objectStore(ALIGNMENT_TELEMETRY_STORE_NAME);
    const read = store.get(projectId);
    read.onsuccess = () => {
      const current = (read.result as ProjectTelemetry | undefined) ?? { lines: {} };
      const next: ProjectTelemetry = { lines: { ...current.lines } };
      for (const line of lines) next.lines[line.lineId] = line;
      store.put(next, projectId);
    };
  });
}

async function markTelemetrySent(projectId: string, digest: string): Promise<void> {
  const current = await readProjectTelemetry(projectId);
  if (current) await setInStore(ALIGNMENT_TELEMETRY_STORE_NAME, projectId, { ...current, lastSent: digest });
}

function clearAllTelemetry(): Promise<void> {
  return runTransaction([ALIGNMENT_TELEMETRY_STORE_NAME], "readwrite", (tx) => {
    tx.objectStore(ALIGNMENT_TELEMETRY_STORE_NAME).clear();
  });
}

// -- Exports ------------------------------------------------------------------

export { clearAllTelemetry, markTelemetrySent, readProjectTelemetry, recordAlignedLines };
