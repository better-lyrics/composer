import { useTimelineStore } from "@/views/timeline/timeline-store";

// -- Constants ----------------------------------------------------------------

const GROUP_PING_MS = 700;

// -- Functions ----------------------------------------------------------------

function pingGroup(groupId: string): void {
  useTimelineStore.getState().setPingingGroupId(groupId);
  window.setTimeout(() => {
    if (useTimelineStore.getState().pingingGroupId === groupId) {
      useTimelineStore.getState().setPingingGroupId(null);
    }
  }, GROUP_PING_MS);
}

// -- Exports ------------------------------------------------------------------

export { pingGroup };
