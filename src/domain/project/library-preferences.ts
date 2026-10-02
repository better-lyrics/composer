// -- Constants ----------------------------------------------------------------

const LIBRARY_VIEWS = ["list", "grid"] as const;
const LAUNCH_SCREENS = ["projects", "last-project"] as const;

// -- Types --------------------------------------------------------------------

type LibraryView = (typeof LIBRARY_VIEWS)[number];
type LaunchScreen = (typeof LAUNCH_SCREENS)[number];

// -- Predicates ---------------------------------------------------------------

function isLibraryView(value: unknown): value is LibraryView {
  return typeof value === "string" && (LIBRARY_VIEWS as readonly string[]).includes(value);
}

function isLaunchScreen(value: unknown): value is LaunchScreen {
  return typeof value === "string" && (LAUNCH_SCREENS as readonly string[]).includes(value);
}

// -- Exports ------------------------------------------------------------------

export { isLibraryView, isLaunchScreen };
export type { LibraryView, LaunchScreen };
