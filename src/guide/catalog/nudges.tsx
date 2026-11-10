import { MOVING_OVER_NUDGE_COPY } from "@/guide/catalog/nudge-copy-moving-over";
import { TIMELINE_NUDGE_COPY } from "@/guide/catalog/nudge-copy-timeline";
import { TRANSPORT_NUDGE_COPY } from "@/guide/catalog/nudge-copy-transport";
import { GUIDE_NUDGE_TRIGGERS } from "@/guide/catalog/nudge-triggers";
import { keyBadge, keys } from "@/guide/catalog/keys";
import { NudgeAmount } from "@/guide/catalog/setting-values";
import type { GuideNudge, GuideNudgeCopy } from "@/guide/catalog/types";
import { isAutoAlignAvailable } from "@/stores/alignment";
import { slowerPlaybackRate, useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { lineHasInlineParens } from "@/utils/background-vocal-extraction";
import {
  IconAbc,
  IconBrain,
  IconKeyboard,
  IconMicrophone,
  IconRepeat,
  IconRotateClockwise,
  IconGauge,
  IconUnlink,
  IconUsers,
  IconZoomIn,
} from "@tabler/icons-react";

// -- Copy ---------------------------------------------------------------------

const NUDGE_COPY: Record<string, GuideNudgeCopy> = {
  ...TIMELINE_NUDGE_COPY,
  ...TRANSPORT_NUDGE_COPY,
  ...MOVING_OVER_NUDGE_COPY,
  syllableGap: {
    icon: IconUnlink,
    title: "Trying to pull them apart?",
    body: (
      <>Both sides moved on your last few drags. Hold {keyBadge("Alt")} while you drag the edge and they come apart.</>
    ),
    peek: <>Hold {keyBadge("Alt")} while dragging to pull the edge apart</>,
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
    peek: <>Faster: hold {keyBadge("Mod")} and scroll over the Timeline</>,
  },
  nudgeWithKeys: {
    icon: IconKeyboard,
    title: "Tiny moves are easier with keys",
    body: (
      <>
        Select the word and press {keys("timeline.nudgeLeft")} {keys("timeline.nudgeRight")}. Each press moves it{" "}
        <NudgeAmount />.
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
    body: <>Turn the Rate knob down while you sync. Your timing still lands on the real song.</>,
    peek: <>Slow the song down while you tap</>,
    available: () => slowerPlaybackRate() < useAudioStore.getState().playbackRate,
    primary: {
      label: "Slow it down",
      run: () => useAudioStore.getState().setPlaybackRate(slowerPlaybackRate()),
    },
  },
  tryAutoAlign: {
    icon: IconBrain,
    title: "Want a head start?",
    body: (
      <>
        Time each line first, then Auto-align at the top of Sync times every word for you. Then fix what it gets wrong.
      </>
    ),
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
    body: <>Extract background vocals, or the BG button on a line, makes them their own vocal with their own timing.</>,
    peek: <>"(...)" in a line can be a background vocal</>,
  },
  romanize: {
    icon: IconAbc,
    title: "Want a transliteration under each line?",
    body: <>Composer can write how each line sounds in Latin letters, and keep it in step as you edit.</>,
    peek: <>Add a transliteration under each line</>,
    primary: { label: "Open Languages", run: () => useProjectStore.getState().setActiveTab("languages") },
  },
  extractAll: {
    icon: IconMicrophone,
    title: "Pulling them out one line at a time?",
    body: <>Extract background vocals moves the words in parentheses on every line in one go.</>,
    peek: <>Extract every line at once with this button</>,
    available: () => useProjectStore.getState().lines.some(lineHasInlineParens),
  },
  singerForRange: {
    icon: IconUsers,
    title: "Setting singers line by line?",
    body: <>Click a line number, then {keyBadge("Shift")}+click another. Pick the singer once under Assign agent.</>,
    peek: <>{keyBadge("Shift")}+click line numbers to set many at once</>,
  },
};

// -- Catalog ------------------------------------------------------------------

const GUIDE_NUDGES: readonly GuideNudge[] = GUIDE_NUDGE_TRIGGERS.map((trigger) => ({
  ...trigger,
  ...NUDGE_COPY[trigger.id],
}));

// -- Exports ------------------------------------------------------------------

export { GUIDE_NUDGES };
