import { keys } from "@/guide/catalog/keys";
import { stageTip } from "@/guide/catalog/types";
import {
  IconArrowBackUp,
  IconBrain,
  IconHandClick,
  IconHandStop,
  IconList,
  IconLineDashed,
  IconPlayerTrackNext,
  IconRotateClockwise,
  IconScissors,
  IconGauge,
} from "@tabler/icons-react";

// -- Tips ---------------------------------------------------------------------

const tip = stageTip("sync");

const SYNC_TIPS = [
  tip({ id: "tap", tier: "basics", icon: IconHandClick, title: "Tap each word", gist: <>Play the song and press {keys("sync.tap")} as each word is sung.</> }),
  tip({ id: "fixTap", tier: "basics", icon: IconArrowBackUp, title: "Fix a bad tap", gist: <>{keys("sync.nudgeLeft")} {keys("sync.nudgeRight")} move the last word, {keys("global.undo")} takes it back.</> }),
  tip({ id: "resync", tier: "basics", icon: IconRotateClockwise, title: "Redo one line", gist: <>Pause, click a word in that line, then tap again from there.</> }),
  tip({ id: "hold", tier: "further", icon: IconHandStop, title: "Hold for long words", gist: <>Hold {keys("sync.holdSync")} for as long as the word lasts.</> }),
  tip({ id: "holdTap", tier: "further", icon: IconPlayerTrackNext, title: "Gapless syllables", gist: <>While holding, tap {keys("sync.tap")} to start the next syllable.</> }),
  tip({ id: "speed", tier: "further", icon: IconGauge, title: "Slow the song down", gist: <>Press {keys("global.togglePlaybackSpeed")}, or turn the rate knob.</> }),
  tip({ id: "granularity", tier: "further", icon: IconLineDashed, title: "Lines or words", gist: <>Switch to line timing for a quick first pass.</> }),
  tip({ id: "split", tier: "pro", icon: IconScissors, title: "Split syllables here", gist: <>Click the scissors on a word to split it while you sync.</> }),
  tip({ id: "editTimings", tier: "pro", icon: IconList, title: "See every timing", gist: <>Press {keys("sync.toggleEdit")} to list every line's timing.</> }),
  tip({ id: "autoAlign", tier: "pro", icon: IconBrain, title: "Let Auto-align time the words", gist: <>Press {keys("timeline.autoAlign")} and fix what it gets wrong.</> }),
];

// -- Exports ------------------------------------------------------------------

export { SYNC_TIPS };
