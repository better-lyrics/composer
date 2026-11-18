import { type BracketJoin, needsOnePair, onePairText } from "./background-vocal-brackets";
import type { LyricLine } from "./line";
import { backgroundText } from "./line-text";
import { backgroundTrack } from "./line-track";
import { withBackgroundTrack, withTrackText } from "./line-track-writes";

// -- Functions ----------------------------------------------------------------

function backgroundNeedsOnePair(line: LyricLine, join: BracketJoin, splitChar: string): boolean {
  return needsOnePair(backgroundText(line, splitChar) ?? "", join);
}

// Pairs typed or pasted inside a background become one pair when brackets are extracted; every time stays.
function withOnePairBackground(line: LyricLine, join: BracketJoin, splitChar: string): LyricLine {
  const background = backgroundTrack(line);
  const text = backgroundText(line, splitChar);
  if (!background || !text || !needsOnePair(text, join)) return line;
  return withBackgroundTrack(line, withTrackText(background, onePairText(text, join), splitChar));
}

// -- Exports ------------------------------------------------------------------

export { backgroundNeedsOnePair, withOnePairBackground };
