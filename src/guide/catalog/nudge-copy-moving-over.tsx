import { keyBadge, keys } from "@/guide/catalog/keys";
import type { GuideNudgeCopy } from "@/guide/catalog/types";
import { useShortcutBindingsStore } from "@/stores/shortcut-bindings";
import { presetKeysArray } from "@/stores/shortcut-preset-keys";
import { useUIStore } from "@/stores/ui";
import { switchShortcutPreset } from "@/ui/settings/shortcuts/switch-shortcut-preset";
import { IconArrowsExchange, IconKeyboard } from "@tabler/icons-react";

// -- Helpers ------------------------------------------------------------------

const amllKey = (shortcutId: string) => keyBadge(...presetKeysArray("amll", shortcutId));

const onAmllKeys = () => useShortcutBindingsStore.getState().preset === "amll";

const OPEN_MOVING_OVER = { label: "Open Moving over", run: () => useUIStore.getState().openHelp("moving-over") };

// -- Copy ---------------------------------------------------------------------

const MOVING_OVER_NUDGE_COPY: Record<string, GuideNudgeCopy> = {
  movingOverAmll: {
    icon: IconArrowsExchange,
    title: "Coming from AMLL Tool?",
    body: (
      <>
        Your keys are set. Timing works a bit differently here: {keys("timeline.setWordBegin")},{" "}
        {keys("timeline.stepWord")} and {keys("timeline.setWordEnd")} live on the Timeline with Step timing on.
      </>
    ),
    peek: <>From AMLL Tool? See how timing works here</>,
    primary: OPEN_MOVING_OVER,
  },
  movingOverOsu: {
    icon: IconArrowsExchange,
    title: "Coming from osu!?",
    body: <>Each tap ends the word before it, and taps aren't judged. Hold {keys("sync.holdSync")} to leave a gap.</>,
    peek: <>From osu!? See how tapping works here</>,
    primary: OPEN_MOVING_OVER,
  },
  amllFileKeys: {
    icon: IconKeyboard,
    title: "This one's from AMLL Tool",
    body: (
      <>
        Want your old keys? {amllKey("timeline.setWordBegin")} {amllKey("timeline.stepWord")}{" "}
        {amllKey("timeline.setWordEnd")} time words and {amllKey("global.playPause")} plays.
      </>
    ),
    peek: <>From AMLL Tool? Use the keys you know</>,
    available: () => !onAmllKeys(),
    primary: { label: "Use AMLL Tool keys", run: () => void switchShortcutPreset("amll") },
  },
  amllFileHelp: {
    icon: IconArrowsExchange,
    title: "This one's from AMLL Tool",
    body: <>See how Composer differs from AMLL Tool.</>,
    peek: <>From AMLL Tool? See how Composer differs</>,
    available: onAmllKeys,
    primary: OPEN_MOVING_OVER,
  },
};

// -- Exports ------------------------------------------------------------------

export { MOVING_OVER_NUDGE_COPY };
