import { deleteProject } from "@/lib/open-project";
import { openProjectIdSnapshot, subscribeOpenProjectId } from "@/lib/open-project-session";

// -- Types --------------------------------------------------------------------

interface PendingDeletion {
  readonly ids: readonly string[];
  commit: () => Promise<void>;
  undo: () => void;
}

// -- Constants ----------------------------------------------------------------

const LOG_PREFIX = "[PendingDeletions]";

// -- Module state -------------------------------------------------------------

const pendingBatches = new Map<string, symbol>();
const committedIds = new Set<string>();
const openCommits = new Map<symbol, () => Promise<void>>();
const listeners = new Set<() => void>();
let hiddenIds: ReadonlySet<string> = new Set();

// -- Publishing ---------------------------------------------------------------

function publish(): void {
  hiddenIds = new Set([...pendingBatches.keys(), ...committedIds]);
  for (const listener of listeners) listener();
}

function releaseBatch(ids: readonly string[], batch: symbol): void {
  for (const id of ids) if (pendingBatches.get(id) === batch) pendingBatches.delete(id);
}

// -- Scheduling ---------------------------------------------------------------

function schedulePendingDeletion(ids: readonly string[]): PendingDeletion {
  const batch = Symbol("pending-deletion");
  const unique = [...new Set(ids)];
  for (const id of unique) pendingBatches.set(id, batch);
  let settled = false;

  const commit = async (): Promise<void> => {
    if (settled) return;
    settled = true;
    openCommits.delete(batch);
    const owned = unique.filter((id) => pendingBatches.get(id) === batch);
    const results = await Promise.allSettled(owned.map((id) => deleteProject(id)));
    const failures: unknown[] = [];
    owned.forEach((id, index) => {
      const result = results[index];
      if (result?.status === "fulfilled") committedIds.add(id);
      else failures.push(result?.reason);
    });
    releaseBatch(owned, batch);
    publish();
    if (failures.length === 0) return;
    for (const failure of failures) console.error(LOG_PREFIX, "could not delete a project", failure);
    throw new Error(`${failures.length} of ${owned.length} projects could not be deleted`);
  };

  const undo = (): void => {
    if (settled) return;
    settled = true;
    openCommits.delete(batch);
    releaseBatch(unique, batch);
    publish();
  };

  openCommits.set(batch, commit);
  publish();
  return { ids: unique, commit, undo };
}

function commitAllPendingDeletions(): Promise<void> {
  const commits = [...openCommits.values()];
  return Promise.allSettled(commits.map((commit) => commit())).then(() => undefined);
}

// -- Snapshot -----------------------------------------------------------------

function hiddenProjectIdsSnapshot(): ReadonlySet<string> {
  return hiddenIds;
}

function subscribeHiddenProjectIds(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// -- Wiring -------------------------------------------------------------------

function withdrawOpenedProject(): void {
  const id = openProjectIdSnapshot();
  if (id === undefined || !pendingBatches.has(id)) return;
  pendingBatches.delete(id);
  publish();
}

subscribeOpenProjectId(withdrawOpenedProject);

if (typeof window !== "undefined") {
  window.addEventListener("pagehide", (event) => {
    if (event.persisted) return;
    void commitAllPendingDeletions();
  });
}

// -- Testing ------------------------------------------------------------------

function __resetPendingDeletionsForTests(): void {
  pendingBatches.clear();
  committedIds.clear();
  openCommits.clear();
  hiddenIds = new Set();
}

// -- Exports ------------------------------------------------------------------

export {
  schedulePendingDeletion,
  commitAllPendingDeletions,
  hiddenProjectIdsSnapshot,
  subscribeHiddenProjectIds,
  __resetPendingDeletionsForTests,
};
export type { PendingDeletion };
