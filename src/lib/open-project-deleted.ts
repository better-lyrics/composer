import { forkOpenProject } from "@/lib/open-project";
import { openProjectIdSnapshot, subscribeOpenProjectId } from "@/lib/open-project-session";
import { cancelPendingSave } from "@/lib/persistence-debounce";
import { toast } from "@/utils/toast";

// -- Constants ----------------------------------------------------------------

const LOG_PREFIX = "[OpenProjectDeleted]";

// -- Module state -------------------------------------------------------------

let deletedOpenProjectId: string | undefined;
const listeners = new Set<() => void>();

// -- Publishing ---------------------------------------------------------------

function publishDeletedOpenProjectId(id: string | undefined): void {
  if (id === deletedOpenProjectId) return;
  deletedOpenProjectId = id;
  for (const listener of listeners) listener();
}

// -- Public API ---------------------------------------------------------------

function noteProjectsDeletedElsewhere(ids: readonly string[]): void {
  const openId = openProjectIdSnapshot();
  if (!openId || !ids.includes(openId)) return;
  cancelPendingSave();
  publishDeletedOpenProjectId(openId);
}

function isOpenProjectDeletedElsewhere(): boolean {
  return deletedOpenProjectId !== undefined;
}

function subscribeOpenProjectDeleted(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function keepOpenProjectAsNew(): void {
  if (!isOpenProjectDeletedElsewhere()) return;
  forkOpenProject()
    .then(() => toast.success("Saved as a new project"))
    .catch((error: unknown) => {
      console.error(LOG_PREFIX, "could not keep the project", error);
      toast.error("Couldn't save this as a new project");
    });
}

// -- Wiring -------------------------------------------------------------------

subscribeOpenProjectId(() => {
  if (deletedOpenProjectId !== openProjectIdSnapshot()) publishDeletedOpenProjectId(undefined);
});

// -- Exports ------------------------------------------------------------------

export {
  isOpenProjectDeletedElsewhere,
  keepOpenProjectAsNew,
  noteProjectsDeletedElsewhere,
  subscribeOpenProjectDeleted,
};
