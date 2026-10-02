import { migrateLegacyProject } from "@/lib/project-migration";
import { clearOpenProjectId, createProjectId, setOpenProjectId } from "@/lib/project-repository";
import { getOpenProjectId, onProjectsCleared } from "@/lib/project-storage";

// -- Module state -------------------------------------------------------------

let openProjectIdLookup: Promise<string | undefined> | null = null;
let openProjectIdCreation: Promise<string> | null = null;
let knownOpenProjectId: string | undefined;
let knownSaveTarget: Promise<string> | null = null;
let sessionGeneration = 0;
const listeners = new Set<() => void>();
const openingProjectIds = new Map<string, number>();

// -- Publishing ---------------------------------------------------------------

function publishOpenProjectId(id: string | undefined, generation: number): void {
  if (generation !== sessionGeneration || id === knownOpenProjectId) return;
  knownOpenProjectId = id;
  knownSaveTarget = id === undefined ? null : Promise.resolve(id);
  for (const listener of listeners) listener();
}

// -- Lookup -------------------------------------------------------------------

function findOpenProjectId(): Promise<string | undefined> {
  const generation = sessionGeneration;
  openProjectIdLookup ??= getOpenProjectId()
    .then((id) => id ?? migrateLegacyProject())
    .then(
      (id) => {
        publishOpenProjectId(id, generation);
        return id;
      },
      (error: unknown) => {
        if (generation === sessionGeneration) openProjectIdLookup = null;
        throw error;
      },
    );
  return openProjectIdLookup;
}

function persistOpenProjectId(id: string | undefined): Promise<void> {
  return id === undefined ? clearOpenProjectId() : setOpenProjectId(id);
}

function ensureOpenProjectId(): Promise<string> {
  const generation = sessionGeneration;
  openProjectIdCreation ??= findOpenProjectId()
    .then(async (existing) => {
      if (existing) return existing;
      const id = createProjectId();
      if (generation !== sessionGeneration) return id;
      await setOpenProjectId(id);
      // A switch during this write already lost the race; keep restoring the current id until nothing supersedes us mid-write.
      let restoredThrough = generation;
      while (restoredThrough !== sessionGeneration) {
        restoredThrough = sessionGeneration;
        await persistOpenProjectId(knownOpenProjectId);
      }
      if (generation !== sessionGeneration) return id;
      openProjectIdLookup = Promise.resolve(id);
      publishOpenProjectId(id, generation);
      return id;
    })
    .catch((error: unknown) => {
      if (generation === sessionGeneration) {
        openProjectIdCreation = null;
        openProjectIdLookup = null;
      }
      throw error;
    });
  return openProjectIdCreation;
}

// -- Switching ----------------------------------------------------------------

function adoptOpenProjectId(id: string): void {
  sessionGeneration++;
  openProjectIdLookup = Promise.resolve(id);
  openProjectIdCreation = Promise.resolve(id);
  publishOpenProjectId(id, sessionGeneration);
}

function forgetOpenProjectId(): void {
  sessionGeneration++;
  openProjectIdLookup = null;
  openProjectIdCreation = null;
  publishOpenProjectId(undefined, sessionGeneration);
}

// -- Snapshot -----------------------------------------------------------------

function openProjectIdSnapshot(): string | undefined {
  return knownOpenProjectId;
}

function subscribeOpenProjectId(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// -- Projects in use ----------------------------------------------------------

function beginOpeningProject(id: string): void {
  openingProjectIds.set(id, (openingProjectIds.get(id) ?? 0) + 1);
}

function endOpeningProject(id: string): void {
  const count = openingProjectIds.get(id) ?? 0;
  if (count <= 1) openingProjectIds.delete(id);
  else openingProjectIds.set(id, count - 1);
}

function isProjectInUse(id: string): boolean {
  return id === knownOpenProjectId || openingProjectIds.has(id);
}

// -- Save targets -------------------------------------------------------------

function bindSaveTarget(): Promise<string> {
  if (knownSaveTarget) return knownSaveTarget;
  const target = ensureOpenProjectId();
  // A superseded target is never awaited by its caller; swallow here so it never surfaces as an unhandled rejection.
  target.catch(() => undefined);
  return target;
}

// -- Wiring -------------------------------------------------------------------

onProjectsCleared(forgetOpenProjectId);

// -- Exports ------------------------------------------------------------------

export {
  findOpenProjectId,
  ensureOpenProjectId,
  adoptOpenProjectId,
  forgetOpenProjectId,
  openProjectIdSnapshot,
  subscribeOpenProjectId,
  bindSaveTarget,
  beginOpeningProject,
  endOpeningProject,
  isProjectInUse,
};
