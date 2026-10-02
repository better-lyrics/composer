import { useSyncExternalStore } from "react";
import { openProjectIdSnapshot, subscribeOpenProjectId } from "@/lib/open-project-session";

// -- Helpers ------------------------------------------------------------------

function noOpenProjectOnServer(): undefined {
  return undefined;
}

// -- Hook ---------------------------------------------------------------------

function useOpenProjectId(): string | undefined {
  return useSyncExternalStore(subscribeOpenProjectId, openProjectIdSnapshot, noOpenProjectOnServer);
}

// -- Exports ------------------------------------------------------------------

export { useOpenProjectId };
