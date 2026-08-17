import { useAudioStore } from "@/stores/audio";
import { revealTimeScrollLeft } from "@/views/timeline/coords";
import { useTimelineStore } from "@/views/timeline/timeline-store";

// -- Functions -----------------------------------------------------------------

function seekAndReveal(time: number, scrollContainer: HTMLDivElement | null): void {
  useAudioStore.getState().seekTo(time);
  if (!scrollContainer) return;
  const nextScrollLeft = revealTimeScrollLeft(
    time,
    useTimelineStore.getState().zoom,
    scrollContainer.scrollLeft,
    scrollContainer.clientWidth,
  );
  if (nextScrollLeft !== null) scrollContainer.scrollLeft = nextScrollLeft;
}

// -- Exports -------------------------------------------------------------------

export { seekAndReveal };
