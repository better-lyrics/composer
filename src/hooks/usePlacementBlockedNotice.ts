import { useEffect } from "react";
import { subscribePlacementBlocked } from "@/lib/shared-timing-signals";
import { showPlacementBlockedToast } from "@/utils/group-toast";

// -- Hook ---------------------------------------------------------------------

// Every command refused for want of room says so, whichever view committed it.
function usePlacementBlockedNotice(): void {
  useEffect(() => subscribePlacementBlocked(() => queueMicrotask(showPlacementBlockedToast)), []);
}

// -- Exports ------------------------------------------------------------------

export { usePlacementBlockedNotice };
