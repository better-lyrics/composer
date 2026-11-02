import { stripTrailingSlashes } from "@/utils/url";

// -- Types --------------------------------------------------------------------

type AppScreen = "library" | "editor" | "unison";
type UnisonView = "mine" | "wanted" | "search";

// -- Constants ----------------------------------------------------------------

const LIBRARY_PATH = "/";
const EDITOR_SEGMENT = "editor";
const EDITOR_PATH = `/${EDITOR_SEGMENT}`;
const LIBRARY_LAUNCH_PARAM = "library";
const UNISON_SEGMENT = "unison";
const UNISON_PATH = `/${UNISON_SEGMENT}`;
const UNISON_VIEW_PARAM = "view";

// -- Routing ------------------------------------------------------------------

function screenForPath(pathname: string): AppScreen {
  const path = stripTrailingSlashes(pathname);
  if (path === EDITOR_PATH) return "editor";
  return path === UNISON_PATH ? "unison" : "library";
}

function unisonViewPath(view: UnisonView): string {
  return `${UNISON_PATH}?${UNISON_VIEW_PARAM}=${view}`;
}

// -- Exports ------------------------------------------------------------------

export {
  LIBRARY_PATH,
  LIBRARY_LAUNCH_PARAM,
  EDITOR_SEGMENT,
  EDITOR_PATH,
  UNISON_SEGMENT,
  UNISON_PATH,
  UNISON_VIEW_PARAM,
  screenForPath,
  unisonViewPath,
};
export type { AppScreen, UnisonView };
