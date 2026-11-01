import { openProjectIdSnapshot } from "@/lib/open-project-session";
import { ProjectDeletedError } from "@/lib/project-tombstones";
import { reportStorageWriteError } from "@/lib/storage-signals";

// -- Types --------------------------------------------------------------------

type SaveKind = "project" | "audio" | "stem";
type SaveStatus = "saved" | "saving" | "failed";

// -- Module state -------------------------------------------------------------

let savePending = false;
let writesInFlight = 0;
const failedKinds = new Set<SaveKind>();
let status: SaveStatus = "saved";
const listeners = new Set<() => void>();
const inFlightSaves = new Set<Promise<void>>();

// -- Publishing ---------------------------------------------------------------

function publishStatus(): void {
  const next: SaveStatus = savePending || writesInFlight > 0 ? "saving" : failedKinds.size > 0 ? "failed" : "saved";
  if (next === status) return;
  status = next;
  for (const listener of listeners) listener();
}

// -- Refusals -----------------------------------------------------------------

function isRefusedForClosedProject(error: unknown): boolean {
  return error instanceof ProjectDeletedError && error.projectId !== openProjectIdSnapshot();
}

// -- Public API ---------------------------------------------------------------

function getSaveStatus(): SaveStatus {
  return status;
}

function subscribeSaveStatus(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function setSavePending(pending: boolean): void {
  if (savePending === pending) return;
  savePending = pending;
  publishStatus();
}

function trackSave(kind: SaveKind, write: Promise<void>): Promise<void> {
  writesInFlight++;
  publishStatus();
  const tracked: Promise<void> = write
    .then(
      () => {
        failedKinds.delete(kind);
      },
      (error: unknown) => {
        reportStorageWriteError(error);
        if (isRefusedForClosedProject(error)) return;
        failedKinds.add(kind);
        throw error;
      },
    )
    .finally(() => {
      writesInFlight--;
      publishStatus();
      inFlightSaves.delete(tracked);
    });
  inFlightSaves.add(tracked);
  return tracked;
}

function awaitInFlightSaves(): Promise<void> {
  return Promise.allSettled([...inFlightSaves]).then(() => undefined);
}

function resetSaveStatus(): void {
  savePending = false;
  writesInFlight = 0;
  failedKinds.clear();
  inFlightSaves.clear();
  status = "saved";
}

// -- Exports ------------------------------------------------------------------

export { getSaveStatus, subscribeSaveStatus, setSavePending, trackSave, awaitInFlightSaves, resetSaveStatus };
export type { SaveStatus };
