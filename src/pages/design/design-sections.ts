// -- Types ---------------------------------------------------------------------

type DesignGroup = "Foundations" | "Primitives" | "State machines";

type DesignSectionId =
  | "color"
  | "surfaces"
  | "shape"
  | "type"
  | "buttons"
  | "controls"
  | "fields"
  | "badges"
  | "overlays"
  | "notices"
  | "save-status"
  | "selection-playback"
  | "toasts"
  | "escape-layers";

interface DesignSectionEntry {
  id: DesignSectionId;
  title: string;
  group: DesignGroup;
}

// -- Constants -----------------------------------------------------------------

const DESIGN_SECTIONS: readonly DesignSectionEntry[] = [
  { id: "color", title: "Color", group: "Foundations" },
  { id: "surfaces", title: "Surfaces", group: "Foundations" },
  { id: "shape", title: "Shadows and radii", group: "Foundations" },
  { id: "type", title: "Type", group: "Foundations" },
  { id: "buttons", title: "Buttons", group: "Primitives" },
  { id: "controls", title: "Controls", group: "Primitives" },
  { id: "fields", title: "Fields", group: "Primitives" },
  { id: "badges", title: "Badges and progress", group: "Primitives" },
  { id: "overlays", title: "Overlays", group: "Primitives" },
  { id: "notices", title: "Notices", group: "State machines" },
  { id: "save-status", title: "Save status", group: "State machines" },
  { id: "selection-playback", title: "Selection playback", group: "State machines" },
  { id: "toasts", title: "Toast stack", group: "State machines" },
  { id: "escape-layers", title: "Escape layers", group: "State machines" },
];

const DESIGN_GROUPS: readonly DesignGroup[] = ["Foundations", "Primitives", "State machines"];

const SECTION_BY_ID = new Map(DESIGN_SECTIONS.map((section) => [section.id, section]));

// -- Functions -----------------------------------------------------------------

function designSectionTitle(id: DesignSectionId): string {
  return SECTION_BY_ID.get(id)?.title ?? id;
}

// -- Exports -------------------------------------------------------------------

export { DESIGN_GROUPS, DESIGN_SECTIONS, designSectionTitle };
export type { DesignSectionId };
