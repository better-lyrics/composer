import { withAlignedTransliteration } from "@/domain/language/align";
import type { LanguagePiece } from "insync/language";
import { languageSide, pieceOf, trackPieces } from "@/domain/language/pieces";
import type { LyricLine } from "insync/line";
import type { WordTrack } from "insync/line-track";
import type { WordTiming } from "insync/word-timing";

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
