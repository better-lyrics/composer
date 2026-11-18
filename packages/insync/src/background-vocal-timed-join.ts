import { type BracketJoin, wordsOpeningPair } from "./background-vocal-brackets";
import { withBackground } from "./line-background";
import type { LyricLine } from "./line";
import { backgroundTrack, isSpanTimed, timedSyllables } from "./line-track";
import { withBackgroundTrack, withTrackText } from "./line-track-writes";

// -- Functions ----------------------------------------------------------------

// A background timed by hand takes new text without losing a time: a span stays over the whole text, and timed words
// stay exactly as they are with the new text untimed after them.
function withTimedBackgroundJoined(line: LyricLine, text: string, join: BracketJoin, splitChar: string): LyricLine {
  const background = backgroundTrack(line);
  if (!background) return line;
  if (isSpanTimed(background)) return withBackgroundTrack(line, withTrackText(background, text, splitChar));
  const timed = timedSyllables(background);
  const words = timed.length < background.syllables.length ? [...timed] : wordsOpeningPair(timed, join);
  return withBackground(line, { text, words, source: background.source ?? "manual" }, splitChar);
}

// -- Exports ------------------------------------------------------------------

export { withTimedBackgroundJoined };
