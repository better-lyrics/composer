import { stripTrailingSlashes } from "@/utils/url";

// -- Types --------------------------------------------------------------------

type AppScreen = "library" | "editor";

// -- Constants ----------------------------------------------------------------

const LIBRARY_PATH = "/";
const EDITOR_SEGMENT = "editor";
const EDITOR_PATH = `/${EDITOR_SEGMENT}`;
const LIBRARY_LAUNCH_PARAM = "library";

// -- Routing ------------------------------------------------------------------

function screenForPath(pathname: string): AppScreen {
  return stripTrailingSlashes(pathname) === EDITOR_PATH ? "editor" : "library";
}

// -- Exports ------------------------------------------------------------------

export { LIBRARY_PATH, LIBRARY_LAUNCH_PARAM, EDITOR_SEGMENT, EDITOR_PATH, screenForPath };
export type { AppScreen };
