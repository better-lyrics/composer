import {
  IconBackspace,
  IconChevronsUp,
  IconCursorText,
  IconLayoutRows,
  IconListCheck,
  IconMagnet,
  IconMarquee2,
  IconPlayerPlayFilled,
  IconPlayerTrackPrev,
  IconStepInto,
} from "@tabler/icons-react";
import { keyBadge, keys } from "@/guide/catalog/keys";
import type { GuideNudgeCopy } from "@/guide/catalog/types";
import { useSettingsStore } from "@/stores/settings";
import { setStepTimingMode } from "@/views/timeline/step-timing/press-step-key";

// -- Copy ---------------------------------------------------------------------

const TIMELINE_NUDGE_COPY: Record<string, GuideNudgeCopy> = {
  stepTimingFirst: {
    icon: IconStepInto,
    title: "Step timing is on",
    body: (
      <>
        Click a word. Press {keys("timeline.setWordBegin")} where it starts, {keys("timeline.stepWord")} where the next
        word begins, or {keys("timeline.setWordEnd")} where it ends if there's a pause after it.
      </>
    ),
    peek: (
      <>
        {keys("timeline.setWordBegin")} starts a word, {keys("timeline.stepWord")} moves on,{" "}
        {keys("timeline.setWordEnd")} ends with a gap
      </>
    ),
  },
  stepKeyWhileOff: {
    icon: IconStepInto,
    title: "Step timing is off",
    body: (
      <>
        Press {keys("timeline.stepTimingOff")} to turn it on. Then {keys("timeline.stepWord")} ends the selected word
        and starts the next.
      </>
    ),
    peek: <>Press {keys("timeline.stepTimingOff")} to turn on Step timing</>,
    primary: { label: "Turn it on", run: () => setStepTimingMode(true) },
  },
  stepWholeLane: {
    icon: IconLayoutRows,
    title: "Timing these one by one?",
    body: (
      <>Click an empty spot in the lane to pick the whole lane. The timing keys then go through just those words.</>
    ),
    peek: <>Click an empty spot to pick the whole lane</>,
  },
  stepBackgroundPass: {
    icon: IconPlayerTrackPrev,
    title: "Background vocals next?",
    body: (
      <>
        Move the playhead back, click an empty spot in the background lane, and time those words the same way. Overlaps
        are fine. Or tap Include them, and the keys go there after each line's lead words.
      </>
    ),
    peek: <>Move back and click the background lane to time it</>,
    available: () => !useSettingsStore.getState().stepTimingBackground,
    primary: { label: "Include them", run: () => useSettingsStore.getState().set("stepTimingBackground", true) },
  },
  stepQueueEnd: {
    icon: IconListCheck,
    title: "End of your queue",
    body: (
      <>
        The timing keys stop after the last word you picked. Click any word to carry on from there, or press Escape to
        clear the queue.
      </>
    ),
    peek: <>Click a word to carry on</>,
  },
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
