import { projectAudioSource } from "@/audio/project-audio-source";
import { type HeardRange, mergeRanges, withoutSpans } from "@/domain/alignment/heard-ranges";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";

// -- Constants ----------------------------------------------------------------

const MAX_CONTINUOUS_STEP_SECONDS = 1;

// -- State --------------------------------------------------------------------

let scope: { session: number; song: string | null } | null = null;
let closed: HeardRange[] = [];
let open: HeardRange | null = null;
let lastTime: number | null = null;

// -- Functions ----------------------------------------------------------------

function followSongScope(): void {
  const session = useProjectStore.getState().projectSession;
  const audio = projectAudioSource(useAudioStore.getState());
  const song = audio ? (audio.kind === "file" ? `file:${audio.name}` : `youtube:${audio.videoId}`) : null;
  if (scope?.session === session && (scope.song === song || scope.song === null)) {
    scope.song = song;
    return;
  }
  scope = { session, song };
  closed = [];
  open = null;
  lastTime = null;
}

function noteHeardTime(event: Event): void {
  const audio = event.currentTarget;
  if (!(audio instanceof HTMLMediaElement)) return;
  if (event.type === "seeking" || audio.seeking) {
    lastTime = null;
    return;
  }
  if (audio.paused) {
    lastTime = audio.currentTime;
    return;
  }
  followSongScope();
  const time = audio.currentTime;
  if (lastTime !== null && time >= lastTime && time - lastTime <= MAX_CONTINUOUS_STEP_SECONDS) {
    if (open !== null && open[1] === lastTime) open[1] = time;
    else {
      if (open !== null) closed = mergeRanges([...closed, open]);
      open = [lastTime, time];
    }
  }
  lastTime = time;
}

function heardRanges(): HeardRange[] {
  followSongScope();
  return mergeRanges(open === null ? closed : [...closed, open]);
}

function restoreHeardRanges(ranges: HeardRange[]): void {
  followSongScope();
  closed = mergeRanges(ranges);
  open = null;
}

function forgetHeardSpans(spans: readonly { begin: number; end: number }[]): void {
  closed = withoutSpans(heardRanges(), spans);
  open = null;
  lastTime = null;
}

// -- Exports ------------------------------------------------------------------

export { forgetHeardSpans, heardRanges, noteHeardTime, restoreHeardRanges };
