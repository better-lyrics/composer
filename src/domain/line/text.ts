import type { LyricLine } from "@/domain/line/model";

// -- Functions ----------------------------------------------------------------

function lineText(line: LyricLine): string {
  return line.text;
}

function backgroundText(line: LyricLine): string | undefined {
  return line.backgroundText;
}

// -- Exports ------------------------------------------------------------------

export { backgroundText, lineText };
