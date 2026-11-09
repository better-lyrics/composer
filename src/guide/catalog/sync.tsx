import { isAutoAlignAvailable } from "@/stores/alignment";
import { keys } from "@/guide/catalog/keys";
import { stageTip } from "@/guide/catalog/types";
import { UndoKeys } from "@/ui/undo-hint";
import {
  IconArrowBackUp,
  IconBrain,
  IconHandClick,
  IconHandStop,
  IconLineDashed,
  IconPlayerTrackNext,
  IconRotateClockwise,
  IconScissors,
  IconGauge,
} from "@tabler/icons-react";

// -- Tips ---------------------------------------------------------------------

const tip = stageTip("sync");

const SYNC_TIPS = [
  tip({
    id: "tap",
    tier: "basics",
    icon: IconHandClick,
    title: "Tap each word",
    gist: <>Play the song and press {keys("sync.tap")} as each word is sung.</>,
    spot: { stage: "sync", spot: "play", text: <>Play, then press {keys("sync.tap")} as each word is sung</> },
  }),
  tip({
    id: "fixTap",
    tier: "basics",
    icon: IconArrowBackUp,
    title: "Take back a bad tap",
    gist: (
      <>
        Press <UndoKeys className="ml-0" /> and tap that word again.
      </>
    ),
  }),
  tip({
    id: "resync",
    tier: "basics",
    icon: IconRotateClockwise,
    title: "Redo one line",
    gist: <>Pause, click the line to jump back to it, then press {keys("sync.tap")} from there.</>,
  }),
  tip({
    id: "hold",
    tier: "further",
    icon: IconHandStop,
    title: "Hold for long words",
    gist: <>Hold {keys("sync.holdSync")} for as long as the word lasts.</>,
  }),
  tip({
    id: "holdTap",
    tier: "further",
    icon: IconPlayerTrackNext,
    title: "Gapless syllables",
    gist: (
      <>
        While holding {keys("sync.holdSync")}, tap {keys("sync.tap")} to start the next syllable.
      </>
    ),
  }),
  tip({
    id: "speed",
    tier: "further",
    icon: IconGauge,
    title: "Slow the song down",
    gist: <>Turn the Rate knob down, or press {keys("global.togglePlaybackSpeed")} to switch speeds.</>,
    spot: { stage: "sync", spot: "rate", text: "Turn this down to slow the song" },
  }),
  tip({
    id: "granularity",
    tier: "further",
    icon: IconLineDashed,
    title: "Lines or words",
    gist: <>Pick Line in the Sync header for a quick first pass.</>,
  }),
  tip({
    id: "split",
    tier: "pro",
    icon: IconScissors,
    title: "Split syllables here",
    gist: <>Pause, then click the scissors on a synced word to split it into syllables.</>,
  }),
  tip({
    id: "autoAlign",
    tier: "pro",
    appliesWhen: isAutoAlignAvailable,
    icon: IconBrain,
    title: "Let Auto-align time the words",
    gist: <>Time your lines first, then Auto-align at the top of Sync times every word.</>,
  }),
];

// -- Exports ------------------------------------------------------------------

export { SYNC_TIPS };
