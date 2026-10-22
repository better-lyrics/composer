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
const SAME_TIME_TOLERANCE_S = 0.05;

// -- Module state -------------------------------------------------------------

let pending: PendingResumePosition | null = null;
let timer: number | null = null;

// -- Capture ------------------------------------------------------------------

// A restored view the Timeline has not shown yet is still the truth, until the playhead or zoom moves away from it.
function capturePendingView(view: ResumePosition, zoom: number): ResumePosition {
  const time = useAudioStore.getState().currentTime;
  if (Math.abs(time - view.time) < SAME_TIME_TOLERANCE_S && zoom === view.zoom) return view;
  const moved = { time, zoom };
  useTimelineStore.getState().setPendingResumeView(moved);
  return moved;
}

function captureResumePosition(): ResumePosition {
  const { zoom, scrollLeft, scrollTop, pendingResumeView } = useTimelineStore.getState();
  if (pendingResumeView) return capturePendingView(pendingResumeView, zoom);
  const position: ResumePosition = { time: livePlaybackTime(), zoom };
  if (scrollTop !== null) position.scroll = { left: scrollLeft, top: scrollTop };
  return position;
}

function rememberResumePosition(): void {
  if (isRestoringProject()) return;
  // Restore cannot reopen a group, so the view from before the group opened is the one worth keeping.
  if (useTimelineStore.getState().focusedGroup) return;
  const id = openProjectIdSnapshot();
  if (!id) return;
  if (pending && pending.id !== id) void flushResumePosition();
  pending = { id, position: captureResumePosition() };
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

// Playback may still be running, so no pause has captured the position being left.
function saveResumePositionNow(): void {
  rememberResumePosition();
  void flushResumePosition();
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
      state.zoom !== previous.zoom ||
      state.scrollLeft !== previous.scrollLeft ||
      state.scrollTop !== previous.scrollTop;
    // Follow mode scrolls every frame during playback; the pause captures the final view.
    if (viewChanged && !useAudioStore.getState().isPlaying) rememberResumePosition();
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

export { flushResumePosition, saveResumePositionNow, watchResumePosition };
