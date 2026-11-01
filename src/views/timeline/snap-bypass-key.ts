import { useTimelineStore } from "@/views/timeline/timeline-store";

// -- Functions -----------------------------------------------------------------

function holdsSnapBypass(event: { metaKey: boolean; ctrlKey: boolean }): boolean {
  return event.metaKey || event.ctrlKey;
}

function syncSnapBypass(event: { metaKey: boolean; ctrlKey: boolean }): void {
  const held = holdsSnapBypass(event);
  if (useTimelineStore.getState().isBypassing !== held) useTimelineStore.getState().setIsBypassing(held);
}

// -- Exports -------------------------------------------------------------------

export { holdsSnapBypass, syncSnapBypass };
