import { keyBadge, keys } from "@/guide/catalog/keys";
import type { GuideNudgeCopy } from "@/guide/catalog/types";
import {
  IconBackspace,
  IconChevronsUp,
  IconCursorText,
  IconMagnet,
  IconMarquee2,
  IconPlayerPlayFilled,
} from "@tabler/icons-react";

// -- Copy ---------------------------------------------------------------------

const TIMELINE_NUDGE_COPY: Record<string, GuideNudgeCopy> = {
  skipSnapOnce: {
    icon: IconMagnet,
    title: "Turning snap off for one drag?",
    body: <>Leave snap on and hold {keyBadge("Mod")} while you drag. Snap skips that drag only.</>,
    peek: <>Hold {keyBadge("Mod")} while dragging to skip snap once</>,
  },
  collapseEveryGroup: {
    icon: IconChevronsUp,
    title: "Collapsing groups one by one?",
    body: <>{keys("timeline.toggleAllCollapsed")} collapses or expands every group at once.</>,
    peek: <>Collapse every group at once with {keys("timeline.toggleAllCollapsed")}</>,
  },
  moveWordsTogether: {
    icon: IconMarquee2,
    title: "Moving a line word by word?",
    body: <>Drag a box around the words, or {keyBadge("Mod")}+click each one, then drag them together.</>,
    peek: <>Drag a box around the words to move them together</>,
  },
  editTextDirectly: {
    icon: IconCursorText,
    title: "Edit a word without the menu",
    body: <>Double-click a word, or select it and press {keys("timeline.editWord")}.</>,
    peek: <>Double-click a word to edit it</>,
  },
  deleteWithKey: {
    icon: IconBackspace,
    title: "Delete without the menu",
    body: <>Select the words and press {keys("timeline.deleteSelection")}.</>,
    peek: <>Select words and press {keys("timeline.deleteSelection")} to delete</>,
  },
  playSelectionWithKey: {
    icon: IconPlayerPlayFilled,
    title: "Play without the menu",
    body: <>Select words and press {keys("timeline.playSelection")} to hear just them.</>,
    peek: <>Press {keys("timeline.playSelection")} to play what you selected</>,
  },
};

// -- Exports ------------------------------------------------------------------

export { TIMELINE_NUDGE_COPY };
