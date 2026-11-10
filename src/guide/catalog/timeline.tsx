import {
  IconArrowBackUp,
  IconArrowsHorizontal,
  IconArrowsMove,
  IconChartHistogram,
  IconColumns,
  IconCopy,
  IconCursorText,
  IconEar,
  IconFlame,
  IconFocus2,
  IconGridDots,
  IconHandFinger,
  IconKeyboard,
  IconLayoutRows,
  IconMapPin,
  IconMicrophone2,
  IconMouse,
  IconPlayerPlayFilled,
  IconRepeat,
  IconRewindBackward5,
  IconScissors,
  IconSelect,
  IconSelectAll,
  IconStepInto,
  IconUnlink,
  IconWaveSine,
  IconZoomIn,
} from "@tabler/icons-react";
import { keyBadge, keys } from "@/guide/catalog/keys";
import { NudgeAmount } from "@/guide/catalog/setting-values";
import { stageTip } from "@/guide/catalog/types";
import { UndoKeys } from "@/ui/undo-hint";

// -- Tips ---------------------------------------------------------------------

const tip = stageTip("timeline");

const TIMELINE_TIPS = [
  tip({
    id: "select",
    tier: "basics",
    icon: IconHandFinger,
    title: "Pick a word",
    gist: <>Click a word to select it.</>,
  }),
  tip({
    id: "move",
    tier: "basics",
    icon: IconArrowsMove,
    title: "Move it in time",
    gist: <>Drag a word left or right.</>,
  }),
  tip({
    id: "resize",
    tier: "basics",
    icon: IconArrowsHorizontal,
    title: "Change where it starts or ends",
    gist: <>Drag either edge of a word.</>,
  }),
  tip({
    id: "play",
    tier: "further",
    icon: IconPlayerPlayFilled,
    title: "Hear just that bit",
    gist: <>Select words, then press {keys("timeline.playSelection")}.</>,
  }),
  tip({
    id: "zoom",
    tier: "basics",
    icon: IconZoomIn,
    title: "Zoom in close",
    gist: <>Hold {keyBadge("Mod")} and scroll over the Timeline.</>,
    spot: { stage: "timeline", spot: "zoom", text: <>Zoom here, or hold {keyBadge("Mod")} and scroll</> },
  }),
  tip({
    id: "undo",
    tier: "basics",
    icon: IconArrowBackUp,
    title: "Take it back",
    gist: (
      <>
        Press <UndoKeys className="ml-0" /> to undo any edit, even a big drag.
      </>
    ),
  }),
  tip({
    id: "selectMore",
    tier: "further",
    icon: IconSelectAll,
    title: "Select more words",
    gist: <>{keyBadge("Mod")}+click adds a word, or drag a box around several.</>,
  }),
  tip({
    id: "gap",
    tier: "further",
    icon: IconUnlink,
    title: "Open a gap between syllables",
    gist: <>Hold {keyBadge("Alt")} while you drag the edge between them.</>,
  }),
  tip({
    id: "loop",
    tier: "further",
    icon: IconRepeat,
    title: "Loop a hard part",
    gist: <>Drag across the waveform. That part repeats while you fix it.</>,
  }),
  tip({
    id: "nudge",
    tier: "further",
    icon: IconKeyboard,
    title: "Nudge without the mouse",
    gist: (
      <>
        Press {keys("timeline.nudgeLeft")} {keys("timeline.nudgeRight")} to move the selection <NudgeAmount />.
      </>
    ),
  }),
  tip({
    id: "rolling",
    tier: "further",
    icon: IconColumns,
    title: "Rolling edits",
    gist: <>Turn on Rolling ({keys("timeline.toggleRollingEdit")}), then drag a shared edge. Both words stay flush.</>,
  }),
  tip({
    id: "cue",
    tier: "further",
    icon: IconRewindBackward5,
    title: "Replay from the cue",
    gist: <>Press {keys("timeline.playFromCue")} to play again from the Cue, where you last clicked.</>,
  }),
  tip({
    id: "atPlayhead",
    tier: "further",
    icon: IconSelect,
    title: "Grab the word you hear",
    gist: <>Press {keys("timeline.selectWordAtPlayhead")} to select the word under the playhead.</>,
  }),
  tip({
    id: "copy",
    tier: "further",
    icon: IconCopy,
    title: "Reuse timing",
    gist: (
      <>
        Press {keys("timeline.copy")} on some words, then {keys("timeline.paste")} and click where the timing goes.
      </>
    ),
  }),
  tip({
    id: "split",
    tier: "further",
    icon: IconScissors,
    title: "Split a word",
    gist: <>Select a word and press {keys("timeline.splitSyllable")} to pick where it splits into syllables.</>,
  }),
  tip({
    id: "editText",
    tier: "further",
    icon: IconCursorText,
    title: "Fix a typo in place",
    gist: <>Press {keys("timeline.editWord")} or double-click a word to edit it.</>,
  }),
  tip({
    id: "scrub",
    tier: "further",
    icon: IconMouse,
    title: "Scrub with the wheel",
    gist: <>Scroll over the waveform to move the playhead.</>,
  }),
  tip({
    id: "stems",
    tier: "pro",
    icon: IconEar,
    title: "Hear only the vocal",
    gist: <>Click Separate in the Stem menu, then press {keys("global.toggleStem")} to hear the vocal alone.</>,
  }),
  tip({
    id: "spectrum",
    tier: "pro",
    icon: IconChartHistogram,
    title: "See the voice",
    gist: <>Press {keys("timeline.toggleSpectrum")} for a spectrum. Drag an edge and a close-up opens.</>,
  }),
  tip({
    id: "pitch",
    tier: "pro",
    needs: "timeline.stems",
    icon: IconWaveSine,
    title: "Follow the melody",
    gist: <>Press {keys("timeline.togglePitchLine")} to draw the melody inside the word blocks.</>,
  }),
  tip({
    id: "beats",
    tier: "pro",
    icon: IconGridDots,
    title: "Snap to the beat",
    gist: <>Click Detect beats under Beat grid in the Snap menu, and drags snap to the beat.</>,
  }),
  tip({
    id: "onsets",
    tier: "pro",
    needs: "timeline.stems",
    icon: IconMicrophone2,
    title: "Snap to where words start",
    gist: (
      <>
        Once the vocal is separated, drags snap to where the voice comes in. Vocal onsets in the Snap menu turns it on
        or off.
      </>
    ),
  }),
  tip({
    id: "markers",
    tier: "pro",
    icon: IconMapPin,
    title: "Drop your own markers",
    gist: <>Press {keys("timeline.dropSnapMarkerAtPlayhead")} to mark a moment you can snap to.</>,
  }),
  tip({
    id: "openGroup",
    tier: "pro",
    icon: IconFocus2,
    title: "Work on one chorus",
    gist: <>Select words in a group and press {keys("timeline.openGroup")} to see only its lines.</>,
  }),
  tip({
    id: "explicit",
    tier: "pro",
    icon: IconFlame,
    title: "Mark explicit words",
    gist: <>Select a word and press {keys("timeline.toggleExplicit")}.</>,
  }),
  tip({
    id: "stepTiming",
    tier: "pro",
    icon: IconStepInto,
    title: "Time word after word",
    gist: (
      <>
        Press {keys("timeline.stepWord")} to turn on Step timing and click a word. {keys("timeline.setWordBegin")} sets
        where it starts. {keys("timeline.stepWord")} ends it and starts the next word in the same spot.{" "}
        {keys("timeline.setWordEnd")} ends it and leaves a gap before the next.
      </>
    ),
    spot: { stage: "timeline", spot: "snap", text: "Step timing is the last switch in this group" },
  }),
  tip({
    id: "stepLane",
    tier: "pro",
    needs: "timeline.stepTiming",
    icon: IconLayoutRows,
    title: "Retime just one lane",
    gist: (
      <>
        In Step timing, click an empty spot in a lane, like the background vocals. The keys then go through only those
        words.
      </>
    ),
  }),
];

// -- Exports ------------------------------------------------------------------

export { TIMELINE_TIPS };
