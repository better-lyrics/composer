import { keys } from "@/guide/catalog/keys";
import type { GuideNudgeCopy } from "@/guide/catalog/types";
import { IconGauge, IconKeyboard, IconLayoutNavbar, IconPlayerPlay, IconPlayerTrackPrev } from "@tabler/icons-react";

// -- Copy ---------------------------------------------------------------------

const TRANSPORT_NUDGE_COPY: Record<string, GuideNudgeCopy> = {
  tapWithKey: {
    icon: IconKeyboard,
    title: "Tap with the keyboard",
    body: (
      <>Press {keys("sync.tap")} as each word starts. You don't have to aim, so your eyes can stay on the lyrics.</>
    ),
    peek: <>Tap with {keys("sync.tap")} instead of clicking</>,
  },
  playWithKey: {
    icon: IconPlayerPlay,
    title: "Play from the keyboard",
    body: <>{keys("global.playPause")} plays and pauses on every tab. Your pointer can stay where it is.</>,
    peek: <>Press {keys("global.playPause")} to play and pause</>,
  },
  seekWithKeys: {
    icon: IconPlayerTrackPrev,
    title: "Going back a few seconds?",
    body: (
      <>
        Press {keys("global.seekBackward")} to go back a few seconds and {keys("global.seekForward")} to go ahead.
      </>
    ),
    peek: <>Press {keys("global.seekBackward")} to go back a few seconds</>,
  },
  speedToggle: {
    icon: IconGauge,
    title: "Switching speeds by hand?",
    body: <>{keys("global.togglePlaybackSpeed")} switches between normal speed and the other speed you last used.</>,
    peek: <>Press {keys("global.togglePlaybackSpeed")} to switch between two speeds</>,
  },
  tabsWithKeys: {
    icon: IconLayoutNavbar,
    title: "Switch tabs from the keyboard",
    body: (
      <>
        Each tab has its own key: {keys("global.goToEdit")} for Edit, {keys("global.goToTimeline")} for Timeline, and so
        on.
      </>
    ),
    peek: <>Each tab has a key, like {keys("global.goToTimeline")}</>,
  },
};

// -- Exports ------------------------------------------------------------------

export { TRANSPORT_NUDGE_COPY };
