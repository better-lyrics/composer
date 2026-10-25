import type { PitchLineMode } from "@/domain/pitch/pitch-line-mode";
import { pitchLineMotion } from "@/utils/animationVariants";

// -- Types ---------------------------------------------------------------------

interface PitchArrival {
  scope: HTMLElement;
  viewport: HTMLElement;
  zoom: number;
  mode: PitchLineMode;
}

// -- State ---------------------------------------------------------------------

// A remount (tab switch, project reload) must not replay a wipe that already ran.
let playedArrival: number | null = null;

// -- Functions -----------------------------------------------------------------

function claimArrival(arrivedAt: number | null): boolean {
  if (arrivedAt === null || arrivedAt === playedArrival) return false;
  playedArrival = arrivedAt;
  return true;
}

// Fraction of the wipe's duration at which its edge reaches a given fraction of the width.
function timeToReach(fraction: number): number {
  const [x1, y1, x2, y2] = pitchLineMotion.wipeEase;
  const at = (a: number, b: number, u: number) => 3 * a * u * (1 - u) ** 2 + 3 * b * u * u * (1 - u) + u ** 3;
  for (let u = 0; u <= 1; u += 0.005) if (at(y1, y2, u) >= fraction) return at(x1, x2, u);
  return 1;
}

function isInView(element: Element, box: DOMRect): boolean {
  const rect = element.getBoundingClientRect();
  return rect.bottom > box.top && rect.top < box.bottom && rect.right > box.left && rect.left < box.right;
}

function wipeKeyframes(reducedMotion: boolean): Keyframe[] {
  return reducedMotion
    ? [{ opacity: 0 }, { opacity: 1 }]
    : [{ clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0% 0 0)" }];
}

// Each label rises when the wipe reaches its word.
function scheduleLabelRises(lane: HTMLCanvasElement, zoom: number, rowDelay: number): number {
  const left = Number.parseFloat(lane.style.left);
  const width = Number.parseFloat(lane.style.width);
  let end = 0;
  for (const block of lane.parentElement?.querySelectorAll<HTMLElement>("[data-word-block]") ?? []) {
    const label = block.querySelector<HTMLElement>(":scope > span");
    if (!label) continue;
    const reach = Math.min(
      1,
      Math.max(0, (Number(block.dataset.begin) * zoom + pitchLineMotion.labelLeadPx - left) / width),
    );
    const delay = rowDelay + timeToReach(reach) * pitchLineMotion.wipeMs;
    label.style.setProperty("--rise-delay", `${Math.round(delay)}ms`);
    end = Math.max(end, delay + pitchLineMotion.riseMs);
  }
  return end;
}

// Fresh pitch wipes in row by row over the visible rows; returns a cancel that restores the resting state.
function playPitchArrival({ scope, viewport, zoom, mode }: PitchArrival): () => void {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const labels = scope.querySelectorAll<HTMLElement>("[data-word-block] > span");
  for (const label of labels) label.style.removeProperty("--rise-delay");
  scope.dataset.pitchArriving = "prep";
  scope.dataset.pitch = "off";
  void scope.offsetWidth;

  const box = viewport.getBoundingClientRect();
  const rows = [...scope.querySelectorAll<HTMLElement>("[data-timeline-row]")].filter(
    (row) => isInView(row, box) && [...row.querySelectorAll("[data-word-block]")].some((word) => isInView(word, box)),
  );
  const duration = reducedMotion ? pitchLineMotion.reducedFadeMs : pitchLineMotion.wipeMs;
  const easing = reducedMotion ? "ease-out" : `cubic-bezier(${pitchLineMotion.wipeEase.join(", ")})`;
  const animations: Animation[] = [];
  let end = 0;
  rows.forEach((row, index) => {
    const rowDelay = pitchLineMotion.rowLeadMs + index * pitchLineMotion.rowStaggerMs;
    for (const lane of row.querySelectorAll<HTMLCanvasElement>(".pitch-lane:not([data-sung])")) {
      animations.push(
        lane.animate(wipeKeyframes(reducedMotion), { duration, delay: rowDelay, easing, fill: "backwards" }),
      );
      if (!reducedMotion) end = Math.max(end, scheduleLabelRises(lane, zoom, rowDelay));
    }
    end = Math.max(end, rowDelay + duration);
  });

  scope.style.setProperty("--pitch-rise-ms", `${pitchLineMotion.riseMs}ms`);
  scope.dataset.pitchArriving = "run";
  scope.dataset.pitch = mode;

  const finish = () => {
    delete scope.dataset.pitchArriving;
    scope.style.removeProperty("--pitch-rise-ms");
    for (const label of labels) label.style.removeProperty("--rise-delay");
  };
  const timer = setTimeout(finish, end + 50);
  return () => {
    clearTimeout(timer);
    for (const animation of animations) animation.cancel();
    finish();
  };
}

// -- Exports -------------------------------------------------------------------

export { claimArrival, playPitchArrival };
