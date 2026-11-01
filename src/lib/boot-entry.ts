import { useSettingsStore } from "@/stores/settings";
import { EDITOR_PATH, LIBRARY_LAUNCH_PARAM, LIBRARY_PATH } from "@/utils/app-routes";
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
  if (new URLSearchParams(location.search).has(LIBRARY_LAUNCH_PARAM)) return LIBRARY_PATH;
  if (!reopenLastProject && !hasIncomingLink(location)) return null;
  return `${EDITOR_PATH}${location.search}${location.hash}`;
}

let bootHref: string | null = null;

function redirectBootEntry(): void {
  bootHref = window.location.href;
  const reopenLastProject = useSettingsStore.getState().launchScreen === "last-project";
  const entry = bootEntryPath(window.location, reopenLastProject);
  if (entry) window.history.replaceState(window.history.state, "", entry);
}

function bootLocationHref(): string | null {
  return bootHref;
}

// -- Exports ------------------------------------------------------------------

export { bootEntryPath, bootLocationHref, redirectBootEntry };
