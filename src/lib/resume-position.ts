import type { ResumePosition } from "@/domain/project/resume-position";
import { openProjectIdSnapshot } from "@/lib/open-project-session";
import { setProjectResumePosition } from "@/lib/project-repository";
import { isRestoringProject } from "@/lib/project-restore";
import { livePlaybackTime, useAudioStore } from "@/stores/audio";
import { useTimelineStore } from "@/views/timeline/timeline-store";

// -- Types --------------------------------------------------------------------

interface PendingResumePosition {
  id: string;
  position: ResumePosition;
}

// -- Constants ----------------------------------------------------------------

const LOG_PREFIX = "[ResumePosition]";
const WRITE_DELAY_MS = 500;

// -- Module state -------------------------------------------------------------

let pending: PendingResumePosition | null = null;
let timer: number | null = null;

// -- Capture ------------------------------------------------------------------

function currentResumePosition(): ResumePosition {
  const { zoom, scrollLeft, scrollTop } = useTimelineStore.getState();
  const position: ResumePosition = { time: livePlaybackTime(), zoom };
  if (scrollTop !== null) position.scroll = { left: scrollLeft, top: scrollTop };
  return position;
}

function rememberResumePosition(): void {
  if (isRestoringProject()) return;
  const id = openProjectIdSnapshot();
  if (!id) return;
  pending = { id, position: currentResumePosition() };
  if (timer !== null) window.clearTimeout(timer);
  timer = window.setTimeout(() => {
    void flushResumePosition();
  }, WRITE_DELAY_MS);
}

async function flushResumePosition(): Promise<void> {
  if (timer !== null) window.clearTimeout(timer);
  timer = null;
  const write = pending;
  pending = null;
  if (!write) return;
  try {
    await setProjectResumePosition(write.id, write.position);
  } catch (err) {
    console.error(`${LOG_PREFIX} could not remember the Timeline position:`, err);
  }
}

// -- Watching -----------------------------------------------------------------

function watchResumePosition(): () => void {
  const unsubscribeAudio = useAudioStore.subscribe((state, previous) => {
    const paused = previous.isPlaying && !state.isPlaying;
    const movedWhilePaused = !state.isPlaying && state.currentTime !== previous.currentTime;
    if (paused || movedWhilePaused) rememberResumePosition();
  });
  const unsubscribeTimeline = useTimelineStore.subscribe((state, previous) => {
    const viewChanged =
      state.zoom !== previous.zoom || state.scrollLeft !== previous.scrollLeft || state.scrollTop !== previous.scrollTop;
    if (viewChanged) rememberResumePosition();
  });
  const onVisibilityChange = () => {
    if (document.visibilityState !== "hidden") return;
    rememberResumePosition();
    void flushResumePosition();
  };
  document.addEventListener("visibilitychange", onVisibilityChange);
  return () => {
    unsubscribeAudio();
    unsubscribeTimeline();
    document.removeEventListener("visibilitychange", onVisibilityChange);
  };
}

// -- Exports ------------------------------------------------------------------

export { flushResumePosition, watchResumePosition };
