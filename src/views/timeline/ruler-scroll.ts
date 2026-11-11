import { formatTime } from "@/utils/format-time";
import { type RulerWindow, rulerLabelsInWindow, rulerStep, rulerWindow } from "@/views/timeline/ruler-labels";

// -- Interfaces ----------------------------------------------------------------

interface RulerGeometry {
  duration: number;
  zoom: number;
  laneWidth: number;
}

interface RulerLabels extends RulerGeometry {
  host: HTMLElement;
  pool: HTMLSpanElement[];
  window: RulerWindow | null;
  stale: boolean;
}

// -- Constants -----------------------------------------------------------------

const LABEL_CLASS =
  "absolute top-[7px] pl-[5px] font-mono text-[10.5px] font-medium leading-none text-composer-text-tertiary";

// -- State ---------------------------------------------------------------------

const labelsByTrack = new WeakMap<HTMLElement, RulerLabels>();

// -- Helpers -------------------------------------------------------------------

function labelAt(labels: RulerLabels, index: number): HTMLSpanElement {
  const existing = labels.pool[index];
  if (existing) return existing;
  const span = document.createElement("span");
  span.className = LABEL_CLASS;
  span.setAttribute("aria-hidden", "true");
  labels.host.appendChild(span);
  labels.pool.push(span);
  return span;
}

function drawLabels(labels: RulerLabels, scrollLeft: number): void {
  const { duration, zoom, laneWidth } = labels;
  const next = rulerWindow(labels.window?.start ?? 0, scrollLeft, laneWidth, duration * zoom);
  const moved = labels.window?.start !== next.start || labels.window.width !== next.width;
  labels.window = next;
  if (!moved && !labels.stale) return;
  labels.stale = false;

  const [labelled] = rulerStep(zoom);
  const times = rulerLabelsInWindow(duration, labelled, zoom, next);
  for (let index = 0; index < times.length; index++) {
    const span = labelAt(labels, index);
    const text = formatTime(times[index], 0);
    const left = `${times[index] * zoom}px`;
    if (span.textContent !== text) span.textContent = text;
    if (span.style.left !== left) span.style.left = left;
    if (span.hidden) span.hidden = false;
  }
  for (let index = times.length; index < labels.pool.length; index++) {
    if (!labels.pool[index].hidden) labels.pool[index].hidden = true;
  }
}

// -- Functions -----------------------------------------------------------------

function attachRulerLabels(track: HTMLElement, host: HTMLElement, geometry: RulerGeometry): () => void {
  labelsByTrack.set(track, { ...geometry, host, pool: [], window: null, stale: true });
  return () => {
    labelsByTrack.delete(track);
    host.replaceChildren();
  };
}

// Labels follow the geometry the track was last rendered with, so they never disagree with its ticks.
function updateRulerGeometry(track: HTMLElement, geometry: Partial<RulerGeometry>, scrollLeft: number): void {
  const labels = labelsByTrack.get(track);
  if (!labels) return;
  Object.assign(labels, geometry);
  labels.stale = true;
  drawLabels(labels, scrollLeft);
}

// Follow calls it in its own frame because the scroll event lands a frame later; callers pass a position already read.
function followRulerScroll(track: HTMLElement, scrollLeft: number): void {
  const translate = `${-scrollLeft}px`;
  if (track.style.translate !== translate) track.style.translate = translate;
  const labels = labelsByTrack.get(track);
  if (labels) drawLabels(labels, scrollLeft);
}

// -- Exports -------------------------------------------------------------------

export { attachRulerLabels, followRulerScroll, updateRulerGeometry };
