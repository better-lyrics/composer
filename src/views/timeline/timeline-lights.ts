import type { LyricLine } from "@/domain/line/model";
import { lineStarts, startedLineIndex } from "@/domain/line/line-at-time";

// -- Types ---------------------------------------------------------------------

interface TimelineLights {
  lit: Set<HTMLElement>;
  speaking: Set<HTMLElement>;
  nextLit: Set<HTMLElement>;
  nextSpeaking: Set<HTMLElement>;
  hitRows: Set<HTMLElement>;
  current: HTMLElement | null;
  startsOf: readonly LyricLine[] | null;
  starts: number[];
}

// -- Constants -----------------------------------------------------------------

// A word lights for at least this long, so a very short word still flashes.
const MIN_LIT_SECONDS = 0.08;
// The current line turns over slightly before it starts, as the eye moves ahead.
const CURRENT_LINE_LEAD_SECONDS = 0.15;

// -- Functions -----------------------------------------------------------------

function createTimelineLights(): TimelineLights {
  return {
    lit: new Set(),
    speaking: new Set(),
    nextLit: new Set(),
    nextSpeaking: new Set(),
    hitRows: new Set(),
    current: null,
    startsOf: null,
    starts: [],
  };
}

function restartHit(row: HTMLElement): void {
  const cell = row.querySelector<HTMLElement>(":scope > .line-cell");
  if (!cell) return;
  cell.dataset.hit = cell.dataset.hit === "a" ? "b" : "a";
}

function currentLineIndex(lights: TimelineLights, lines: readonly LyricLine[], time: number): number | null {
  if (lights.startsOf !== lines) {
    lights.startsOf = lines;
    lights.starts = lineStarts(lines);
  }
  const shifted = time + CURRENT_LINE_LEAD_SECONDS;
  const index = startedLineIndex(lights.starts, shifted);
  return lights.starts[index] <= shifted ? index : null;
}

// Lights the sung words, the edge of each line being sung, and the current line, straight on the DOM every frame.
function paintTimelineLights(
  lights: TimelineLights,
  root: ParentNode,
  blocks: readonly HTMLElement[],
  lines: readonly LyricLine[],
  time: number,
): void {
  const lit = lights.nextLit;
  lit.clear();
  for (const word of blocks) {
    const begin = Number(word.dataset.begin);
    const end = Number(word.dataset.end);
    if (time >= begin && time < Math.max(end, begin + MIN_LIT_SECONDS)) lit.add(word);
  }

  const speaking = lights.nextSpeaking;
  speaking.clear();
  for (const word of lit) {
    const row = word.closest<HTMLElement>("[data-timeline-row]");
    if (row) speaking.add(row);
    if (lights.lit.has(word)) continue;
    word.setAttribute("data-lit", "");
    if (row) lights.hitRows.add(row);
  }
  // Once per row: toggling twice in one frame lands on the same name and the flash would not restart.
  for (const row of lights.hitRows) restartHit(row);
  lights.hitRows.clear();
  for (const word of lights.lit) if (!lit.has(word)) word.removeAttribute("data-lit");
  for (const row of speaking) if (!lights.speaking.has(row)) row.setAttribute("data-speaking", "");
  for (const row of lights.speaking) if (!speaking.has(row)) row.removeAttribute("data-speaking");
  lights.nextLit = lights.lit;
  lights.nextSpeaking = lights.speaking;
  lights.lit = lit;
  lights.speaking = speaking;

  const index = currentLineIndex(lights, lines, time);
  const current = index === null ? null : root.querySelector<HTMLElement>(`[data-row-line="${index}"]`);
  if (current === lights.current) return;
  lights.current?.removeAttribute("data-current");
  current?.setAttribute("data-current", "");
  lights.current = current;
}

// -- Exports -------------------------------------------------------------------

export { createTimelineLights, paintTimelineLights };
