import { ALL_GUIDE_TIPS } from "@/guide/catalog/all-tips";
import type { GuideTip } from "@/guide/catalog/types";
import { useSettingsStore } from "@/stores/settings";
import { useMemo } from "react";

// -- Hook ---------------------------------------------------------------------

// Tips for features that are off or unavailable drop out, so they never hold back a medal.
function useGuideTips(): readonly GuideTip[] {
  const hiddenIds = useSettingsStore((settings) =>
    ALL_GUIDE_TIPS.filter((tip) => tip.appliesWhen && !tip.appliesWhen(settings))
      .map((tip) => tip.learnedBy)
      .join(" "),
  );
  return useMemo(() => {
    const hidden = new Set(hiddenIds.split(" "));
    return ALL_GUIDE_TIPS.filter((tip) => !hidden.has(tip.learnedBy));
  }, [hiddenIds]);
}

// -- Exports ------------------------------------------------------------------

export { useGuideTips };
