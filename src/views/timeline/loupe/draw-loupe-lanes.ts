import type { WordTiming } from "@/domain/word/timing";
import { LOUPE_CANVAS, type LoupeFrame, colour, xOf } from "@/views/timeline/loupe/draw-loupe";

// -- Types --------------------------------------------------------------------

interface LoupeLaneWords {
  main: readonly WordTiming[];
  background: readonly WordTiming[];
  edited: { track: "word" | "bg"; wordIndex: number };
  agentColour: string;
  playheadSeconds: number;
}

interface LaneRow {
  y: number;
  height: number;
  radius: number;
  font: string;
  alpha: number;
  textAlpha: number;
}

// -- Constants ----------------------------------------------------------------

const LANE_PAD = 8;
const LANE_GAP = 4;
const MAIN_HEIGHT = 24;
const MIN_BLOCK_WIDTH = 3;
const LABEL_INSET = 4;
const MIN_LABEL_WIDTH = 14;

// -- Helpers ------------------------------------------------------------------

function laneRows(fontFamily: string): Record<"word" | "bg", LaneRow> {
  const top = LOUPE_CANVAS.spectrumHeight + LOUPE_CANVAS.rulerHeight;
  return {
    word: {
      y: top + LANE_PAD,
      height: MAIN_HEIGHT,
      radius: 7,
      font: `500 10.5px ${fontFamily}`,
      alpha: 1,
      textAlpha: 0.94,
    },
    bg: {
      y: top + LANE_PAD + MAIN_HEIGHT + LANE_GAP,
      height: 16,
      radius: 5,
      font: `500 9.5px ${fontFamily}`,
      alpha: 0.85,
      textAlpha: 0.75,
    },
  };
}

function blockFill(frame: LoupeFrame, agent: string, light: boolean, active: boolean): string {
  if (light) {
    const paper = `color-mix(in oklab, white 70%, ${colour(frame, "--color-composer-bg-dark")})`;
    return `color-mix(in oklab, ${agent} 14%, ${paper})`;
  }
  return `color-mix(in oklab, ${agent} ${active ? 58 : 30}%, ${colour(frame, "--word-face")})`;
}

// -- Drawing ------------------------------------------------------------------

// A scaled copy of the edited line's main and background lanes, using the word block recipe.
function drawLoupeLanes(frame: LoupeFrame, lanes: LoupeLaneWords): void {
  const { context } = frame;
  const top = LOUPE_CANVAS.spectrumHeight + LOUPE_CANVAS.rulerHeight;
  context.fillStyle = colour(frame, "--well");
  context.fillRect(0, top, LOUPE_CANVAS.width, LOUPE_CANVAS.height - top);
  const light = document.documentElement.dataset.scheme === "light";
  const ink = colour(frame, "--color-composer-text");
  const rows = laneRows(colour(frame, "--font-sans"));
  context.textBaseline = "middle";
  context.textAlign = "center";
  for (const track of ["word", "bg"] as const) {
    const row = rows[track];
    const words = track === "word" ? lanes.main : lanes.background;
    words.forEach((word, wordIndex) => {
      const x = xOf(frame, word.begin) + 0.5;
      const width = Math.max(xOf(frame, word.end) - xOf(frame, word.begin) - 1, MIN_BLOCK_WIDTH);
      if (x > LOUPE_CANVAS.width || x + width < 0) return;
      const active = lanes.playheadSeconds >= word.begin && lanes.playheadSeconds < word.end;
      const edited = lanes.edited.track === track && lanes.edited.wordIndex === wordIndex;
      context.save();
      context.globalAlpha = row.alpha;
      context.beginPath();
      context.roundRect(x, row.y, width, row.height, Math.min(row.radius, width / 2));
      context.fillStyle = blockFill(frame, lanes.agentColour, light, active);
      context.fill();
      context.lineWidth = 1;
      context.strokeStyle = light
        ? `color-mix(in oklab, ${lanes.agentColour} 30%, transparent)`
        : `color-mix(in oklab, ${ink} 7%, transparent)`;
      context.stroke();
      if (edited) {
        context.lineWidth = 1.5;
        context.strokeStyle = ink;
        context.stroke();
      }
      context.beginPath();
      context.rect(x + LABEL_INSET, row.y, width - LABEL_INSET * 2, row.height);
      context.clip();
      const shownLeft = Math.max(x, 0);
      const shownRight = Math.min(x + width, LOUPE_CANVAS.width);
      if (shownRight - shownLeft > MIN_LABEL_WIDTH) {
        context.fillStyle = ink;
        context.globalAlpha = row.textAlpha;
        context.font = row.font;
        context.fillText(word.text.trim(), (shownLeft + shownRight) / 2, row.y + row.height / 2 + 0.5);
      }
      context.restore();
    });
  }
}

// -- Exports ------------------------------------------------------------------

export { drawLoupeLanes };
export type { LoupeLaneWords };
