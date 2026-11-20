import { useEffect } from "react";
import { markGuideNudgeShown } from "@/lib/guide-signals";
import { subscribeTemplateSplit } from "@/lib/template-split-signals";
import { useGuideStore } from "@/stores/guide";
import { showSplitInAllInstancesToast } from "@/utils/group-toast";

// -- Constants ----------------------------------------------------------------

const SPLIT_IN_ALL_INSTANCES_NOTICE = "group.split-in-all-instances";

// -- Hook ---------------------------------------------------------------------

// The first split that reaches other instances says so, once per device.
function useSplitInAllInstancesNotice(): void {
  useEffect(
    () =>
      subscribeTemplateSplit((instanceCounts) => {
        const count = Math.max(...instanceCounts);
        if (count < 2 || useGuideStore.getState().seenNudges.includes(SPLIT_IN_ALL_INSTANCES_NOTICE)) return;
        markGuideNudgeShown(SPLIT_IN_ALL_INSTANCES_NOTICE);
        queueMicrotask(() => showSplitInAllInstancesToast(count));
      }),
    [],
  );
}

// -- Exports ------------------------------------------------------------------

export { useSplitInAllInstancesNotice };
