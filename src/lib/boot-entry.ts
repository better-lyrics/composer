import { useSettingsStore } from "@/stores/settings";
import { EDITOR_PATH, LIBRARY_PATH } from "@/utils/app-routes";
import { hasIncomingLink } from "@/utils/incoming-link";

// -- Types --------------------------------------------------------------------

interface BootLocation {
  pathname: string;
  search: string;
  hash: string;
}

// -- Entry --------------------------------------------------------------------

function bootEntryPath(location: BootLocation, reopenLastProject: boolean): string | null {
  if (location.pathname !== LIBRARY_PATH) return null;
  if (!reopenLastProject && !hasIncomingLink(location)) return null;
  return `${EDITOR_PATH}${location.search}${location.hash}`;
}

function redirectBootEntry(): void {
  const reopenLastProject = useSettingsStore.getState().launchScreen === "last-project";
  const entry = bootEntryPath(window.location, reopenLastProject);
  if (entry) window.history.replaceState(window.history.state, "", entry);
}

// -- Exports ------------------------------------------------------------------

export { bootEntryPath, redirectBootEntry };
