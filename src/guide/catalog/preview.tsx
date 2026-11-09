import { keys } from "@/guide/catalog/keys";
import { stageTip } from "@/guide/catalog/types";
import { IconLayoutSidebarRight, IconPointer } from "@tabler/icons-react";

// -- Tips ---------------------------------------------------------------------

const tip = stageTip("preview");

const PREVIEW_TIPS = [
  tip({ id: "seek", tier: "basics", icon: IconPointer, title: "Jump to a line", gist: <>Click any line to play from there.</> }),
  tip({ id: "sidebar", tier: "basics", icon: IconLayoutSidebarRight, title: "Preview beside the Timeline", gist: <>Press {keys("timeline.togglePreview")} on the Timeline to watch while you edit.</> }),
];

// -- Exports ------------------------------------------------------------------

export { PREVIEW_TIPS };
