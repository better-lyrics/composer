import { bgVoice, mainVoice } from "@/domain/line/voices";
import type { Bounds } from "@/domain/word/bounds";
import type { LyricLine } from "@/domain/line/model";
import { voiceBounds } from "@/domain/voice/bounds";

// -- Functions ----------------------------------------------------------------

function mainBounds(line: LyricLine): Bounds | null {
  return voiceBounds(mainVoice(line));
}

function bgBounds(line: LyricLine): Bounds | null {
  const bg = bgVoice(line);
  return bg !== null ? voiceBounds(bg) : null;
}

function effectiveBounds(line: LyricLine): Bounds | null {
  const main = mainBounds(line);
  if (!main) return null;
  const bg = bgBounds(line);
  if (!bg) return main;
  return { begin: Math.min(main.begin, bg.begin), end: Math.max(main.end, bg.end) };
}

// -- Exports ------------------------------------------------------------------

export { bgBounds, effectiveBounds, mainBounds };
