import { withAlignedTransliteration } from "@/domain/language/align";
import type { LanguagePiece } from "@/domain/language/model";
import { languageSide, pieceOf, trackPieces } from "@/domain/language/pieces";
import type { LyricLine } from "@/domain/line/model";
import type { WordTrack } from "@/domain/line/track";
import type { WordTiming } from "@/domain/word/timing";

// -- Functions ----------------------------------------------------------------

// The piece a syllable shows: the stored pieces when they still spell the text, else the ones read from it.
function alignedPieceOf(line: LyricLine, type: WordTrack, word: WordTiming): LanguagePiece | undefined {
  return pieceOf(trackPieces(withAlignedTransliteration(line), languageSide(type)), word);
}

// -- Exports ------------------------------------------------------------------

export { alignedPieceOf };
