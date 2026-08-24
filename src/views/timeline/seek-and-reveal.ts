import { scrubPreview } from "@/audio/scrub-preview";
import { useAudioStore } from "@/stores/audio";
import { revealTimeScrollLeft } from "@/views/timeline/coords";
import { useTimelineStore } from "@/views/timeline/timeline-store";

// -- Constants -----------------------------------------------------------------

const KEYBOARD_SCRUB_RATE = 1;

// -- Functions -----------------------------------------------------------------

function seekAndReveal(time: number, scrollContainer: HTMLDivElement | null): void {
  const { seekTo, isPlaying } = useAudioStore.getState();
  seekTo(time);
  if (!isPlaying) scrubPreview.play(time, KEYBOARD_SCRUB_RATE);
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
