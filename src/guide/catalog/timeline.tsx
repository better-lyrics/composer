import { keyBadge, keys } from "@/guide/catalog/keys";
import { stageTip } from "@/guide/catalog/types";
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
  IconMapPin,
  IconMicrophone2,
  IconMouse,
  IconPlayerPlay,
  IconRepeat,
  IconRewindBackward5,
  IconScissors,
  IconSelect,
  IconUnlink,
  IconWaveSine,
  IconZoomIn,
} from "@tabler/icons-react";

// -- Tips ---------------------------------------------------------------------

const tip = stageTip("timeline");

const TIMELINE_TIPS = [
  tip({
    id: "select",
    tier: "basics",
    icon: IconHandFinger,
    title: "Pick a word",
    gist: (
      <>
        Click a word to select it. {keyBadge("Mod")}
        +click adds more.
      </>
    ),
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
    tier: "basics",
    icon: IconPlayerPlay,
    title: "Hear just that bit",
    gist: <>Select words, then press {keys("timeline.playSelection")}.</>,
  }),
  tip({
    id: "zoom",
    tier: "basics",
    icon: IconZoomIn,
    title: "Zoom in close",
    gist: <>Hold {keyBadge("Mod")} and scroll over the Timeline.</>,
  }),
  tip({
    id: "undo",
    tier: "basics",
    icon: IconArrowBackUp,
    title: "Take it back",
    gist: <>Press {keys("global.undo")} to undo anything, even a big drag.</>,
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
        Press {keys("timeline.nudgeLeft")} {keys("timeline.nudgeRight")} to move the selection a hair.
      </>
    ),
  }),
  tip({
    id: "rolling",
    tier: "further",
    icon: IconColumns,
    title: "Rolling edits",
    gist: <>Press {keys("timeline.toggleRollingEdit")}, then drag a shared edge. Both words stay flush.</>,
  }),
  tip({
    id: "cue",
    tier: "further",
    icon: IconRewindBackward5,
    title: "Replay from the cue",
    gist: <>Press {keys("timeline.playFromCue")} to play again from where you last started.</>,
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
        Press {keys("timeline.copy")} on some words, then {keys("timeline.paste")} on another line.
      </>
    ),
  }),
  tip({
    id: "split",
    tier: "further",
    icon: IconScissors,
    title: "Split a word",
    gist: <>Press {keys("timeline.splitSyllable")} to cut a word into syllables.</>,
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
    id: "spectrum",
    tier: "pro",
    icon: IconChartHistogram,
    title: "See the voice",
    gist: <>Press {keys("timeline.toggleSpectrum")} for a spectrum. Drag an edge and a close-up opens.</>,
  }),
  tip({
    id: "pitch",
    tier: "pro",
    icon: IconWaveSine,
    title: "Follow the melody",
    gist: <>Press {keys("timeline.togglePitchLine")} to draw the melody over the rows.</>,
  }),
  tip({
    id: "beats",
    tier: "pro",
    icon: IconGridDots,
    title: "Snap to the beat",
    gist: <>Find the beat, then press {keys("timeline.toggleBeatGrid")} to show bars you can snap to.</>,
  }),
  tip({
    id: "onsets",
    tier: "pro",
    icon: IconMicrophone2,
    title: "Snap to where words start",
    gist: <>Turn on vocal onsets in the Snap menu to catch each consonant.</>,
  }),
  tip({
    id: "stems",
    tier: "pro",
    icon: IconEar,
    title: "Hear only the vocal",
    gist: <>Press {keys("global.toggleStem")} to switch to the vocal on its own.</>,
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
    gist: <>Press {keys("timeline.openGroup")} on a group to see only its lines.</>,
  }),
  tip({
    id: "explicit",
    tier: "pro",
    icon: IconFlame,
    title: "Mark explicit words",
    gist: <>Select a word and press {keys("timeline.toggleExplicit")}.</>,
  }),
];

// -- Exports ------------------------------------------------------------------

export { TIMELINE_TIPS };
