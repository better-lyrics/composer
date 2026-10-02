import { subscribeSharedTimingCopied } from "@/lib/shared-timing-signals";
import { pingGroup } from "@/views/timeline/ping-group";
import { useEffect } from "react";

// -- Hook ---------------------------------------------------------------------

function useSharedTimingPing(): void {
  useEffect(
    () =>
      subscribeSharedTimingCopied((groupIds) => {
        if (groupIds[0] !== undefined) pingGroup(groupIds[0]);
      }),
    [],
  );
}

// -- Exports ------------------------------------------------------------------

export { useSharedTimingPing };
