import { useSyncExternalStore } from "react";
import { isOpenProjectDeletedElsewhere, subscribeOpenProjectDeleted } from "@/lib/open-project-deleted";

// -- Helpers ------------------------------------------------------------------

function notDeletedOnServer(): boolean {
  return false;
}

// -- Hook ---------------------------------------------------------------------

function useOpenProjectDeleted(): boolean {
  return useSyncExternalStore(subscribeOpenProjectDeleted, isOpenProjectDeletedElsewhere, notDeletedOnServer);
}

// -- Exports ------------------------------------------------------------------

export { useOpenProjectDeleted };
