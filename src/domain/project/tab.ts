// -- Constants ----------------------------------------------------------------

const PROJECT_TABS = ["import", "edit", "languages", "sync", "timeline", "preview", "export"] as const;

// -- Types --------------------------------------------------------------------

type ProjectTab = (typeof PROJECT_TABS)[number];

// -- Labels -------------------------------------------------------------------

const TAB_LABELS: Record<ProjectTab, string> = {
  import: "Import",
  edit: "Edit",
  languages: "Languages",
  sync: "Sync",
  timeline: "Timeline",
  preview: "Preview",
  export: "Export",
};

// -- Predicates ---------------------------------------------------------------

function isProjectTab(value: unknown): value is ProjectTab {
  return typeof value === "string" && (PROJECT_TABS as readonly string[]).includes(value);
}

// -- Exports ------------------------------------------------------------------

export { PROJECT_TABS, TAB_LABELS, isProjectTab };
export type { ProjectTab };
