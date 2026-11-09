import { GUIDE_NUDGE_TRIGGERS } from "@/guide/catalog/nudge-triggers";
import { keyBadge, keys } from "@/guide/catalog/keys";
import type { GuideNudge } from "@/guide/catalog/types";
import { isAutoAlignAvailable } from "@/stores/alignment";
import { toggledPlaybackRate, useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import {
  IconAbc,
  IconBrain,
  IconKeyboard,
  IconMicrophone,
  IconRepeat,
  IconRotateClockwise,
  IconGauge,
  IconUnlink,
  IconZoomIn,
} from "@tabler/icons-react";

// -- Types --------------------------------------------------------------------

type NudgeCopy = Omit<GuideNudge, keyof (typeof GUIDE_NUDGE_TRIGGERS)[number]>;

// -- Copy ---------------------------------------------------------------------

const NUDGE_COPY: Record<string, NudgeCopy> = {
  syllableGap: {
    icon: IconUnlink,
    title: "Trying to split two syllables?",
    body: (
      <>
        Both syllables moved on your last few drags. Hold {keyBadge("Alt")} while you drag the edge and they come apart.
      </>
    ),
    peek: <>Hold {keyBadge("Alt")} while dragging to split syllables</>,
  },
  loopHardPart: {
    icon: IconRepeat,
    title: "Going back to the same spot?",
    body: <>Drag across the waveform above that part. It loops while you fix the words.</>,
    peek: <>Back here again? Drag across the waveform to loop it</>,
  },
  zoomFaster: {
    icon: IconZoomIn,
    title: "There's a faster way to zoom",
    body: <>Hold {keyBadge("Mod")} and scroll over the Timeline. It zooms around your pointer.</>,
    peek: <>Hold {keyBadge("Mod")} and scroll to zoom</>,
  },
  nudgeWithKeys: {
    icon: IconKeyboard,
    title: "Tiny moves are easier with keys",
    body: (
      <>
        Select the word and press {keys("timeline.nudgeLeft")} {keys("timeline.nudgeRight")}. Each press moves it a
        hair.
      </>
    ),
    peek: (
      <>
        Press {keys("timeline.nudgeLeft")} {keys("timeline.nudgeRight")} for tiny moves
      </>
    ),
  },
  resyncLine: {
    icon: IconRotateClockwise,
    title: "This line giving you trouble?",
    body: <>Pause, click the first word of the line, and tap it again from there. The rest stays as it is.</>,
    peek: <>Stuck on a line? Click its first word and tap again</>,
  },
  slowDown: {
    icon: IconGauge,
    title: "Taps landing early?",
    body: <>Slow the song down while you sync. Your timing still lands on the real song.</>,
    peek: <>Slow the song down while you tap</>,
    primary: {
      label: "Slow it down",
      run: () => useAudioStore.getState().setPlaybackRate(toggledPlaybackRate()),
    },
  },
  tryAutoAlign: {
    icon: IconBrain,
    title: "Want a head start?",
    body: <>Press {keys("timeline.autoAlign")} and Auto-align times every word for you. Then fix what it gets wrong.</>,
    peek: <>Auto-align can time the words for you</>,
    available: isAutoAlignAvailable,
  },
  keysWhileTyping: {
    icon: IconKeyboard,
    title: "Keep typing while it plays",
    body: (
      <>
        {keys("global.playPauseWhileTyping")} plays and pauses without leaving the lyrics.{" "}
        {keys("global.seekBackwardWhileTyping")} goes back a bit.
      </>
    ),
    peek: <>Play and pause without leaving the lyrics</>,
  },
  backgroundVocal: {
    icon: IconMicrophone,
    title: "Is that a background vocal?",
    body: <>Words in parentheses can become their own background vocal, with their own timing.</>,
    peek: <>"(...)" in a line can be a background vocal</>,
  },
  romanize: {
    icon: IconAbc,
    title: "Want romanization under each line?",
    body: <>Composer can write how each line sounds in Latin letters, and keep it in step as you edit.</>,
    peek: <>Add romanization under each line</>,
    primary: { label: "Open Languages", run: () => useProjectStore.getState().setActiveTab("languages") },
  },
};

// -- Catalog ------------------------------------------------------------------

const GUIDE_NUDGES: readonly GuideNudge[] = GUIDE_NUDGE_TRIGGERS.map((trigger) => ({
  ...trigger,
  ...NUDGE_COPY[trigger.id],
}));

// -- Exports ------------------------------------------------------------------

export { GUIDE_NUDGES };
