// -- Constants ----------------------------------------------------------------

const PROJECT_TABS = ["import", "edit", "languages", "sync", "timeline", "preview", "export"] as const;

// -- Types --------------------------------------------------------------------

type ProjectTab = (typeof PROJECT_TABS)[number];

// -- Predicates ---------------------------------------------------------------

function isProjectTab(value: unknown): value is ProjectTab {
  return typeof value === "string" && (PROJECT_TABS as readonly string[]).includes(value);
}

// -- Exports ------------------------------------------------------------------

export { PROJECT_TABS, isProjectTab };
export type { ProjectTab };
