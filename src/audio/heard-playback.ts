import { type HeardRange, mergeRanges, withoutSpans } from "@/domain/alignment/heard-ranges";
import { useProjectStore } from "@/stores/project";

// -- Constants ----------------------------------------------------------------

const MAX_CONTINUOUS_STEP_SECONDS = 1;

// -- State --------------------------------------------------------------------

let session = -1;
let closed: HeardRange[] = [];
let open: HeardRange | null = null;
let lastTime: number | null = null;

// -- Functions ----------------------------------------------------------------

function followProjectSession(): void {
  const current = useProjectStore.getState().projectSession;
  if (current === session) return;
  session = current;
  closed = [];
  open = null;
  lastTime = null;
}

function noteHeardTime(event: Event): void {
  const audio = event.currentTarget;
  if (!(audio instanceof HTMLMediaElement)) return;
  if (event.type === "seeking") {
    lastTime = null;
    return;
  }
  if (audio.paused) {
    lastTime = audio.currentTime;
    return;
  }
  followProjectSession();
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
  followProjectSession();
  return mergeRanges(open === null ? closed : [...closed, open]);
}

function restoreHeardRanges(ranges: HeardRange[]): void {
  followProjectSession();
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
