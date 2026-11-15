import { withAlignedTransliteration } from "./language-align";
import type { LanguagePiece } from "./language";
import { languageSide, pieceOf, trackPieces } from "./language-pieces";
import type { LyricLine } from "./line";
import type { WordTrack } from "./line-track";
import type { WordTiming } from "./word-timing";

// -- Functions ----------------------------------------------------------------

// The piece a syllable shows: the stored pieces when they still spell the text, else the ones read from it.
function alignedPieceOf(
  line: LyricLine,
  type: WordTrack,
  word: WordTiming,
  splitChar: string,
): LanguagePiece | undefined {
  return pieceOf(trackPieces(withAlignedTransliteration(line, splitChar), languageSide(type)), word);
}

// -- Exports ------------------------------------------------------------------

export { alignedPieceOf };
