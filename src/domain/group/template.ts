import type { LanguagePiece, LanguagePieces, LineLanguages } from "@/domain/language/model";
import { keyedPieces, pieceOf } from "@/domain/language/pieces";
import { withPiecesOn } from "@/domain/language/side-pieces";
import { newWordId } from "@/domain/word/id";
import type { WordTiming } from "@/domain/word/timing";

// -- Types --------------------------------------------------------------------

interface LinkGroup {
  id: string;
  label: string;
  color: string;
  templateVersion: number;
  sharesTiming?: true;
  ownTimingInstances?: number[];
}

interface WordTemplate {
  text: string;
  sep: string;
  joinsNext: boolean;
  relativeBegin: number;
  relativeEnd: number;
  explicit?: true;
  piece?: LanguagePiece;
}

interface LineTemplate {
  text: string;
  agentId: string;
  relativeBegin?: number;
  relativeEnd?: number;
  words?: WordTemplate[];
  backgroundText?: string;
  backgroundWords?: WordTemplate[];
  backgroundTextSource?: "extraction" | "manual";
  /** Pieces stay on the template words, so they follow the words to their new ids. */
  languages?: LineLanguages;
}

// Keep exact alternate fragments and separators when moving between absolute
// timings and templates; an empty string is meaningful for both fields.
function wordsToTemplate(words: WordTiming[], instanceStart: number, pieces?: LanguagePieces): WordTemplate[] {
  return words.map(({ id, begin, end, ...word }) => {
    const piece = pieceOf(pieces, { id, begin, end, ...word });
    return {
      ...word,
      relativeBegin: begin - instanceStart,
      relativeEnd: end - instanceStart,
      ...(piece && { piece: structuredClone(piece) }),
    };
  });
}

function languagesToTemplate(languages: LineLanguages | undefined): LineLanguages | undefined {
  const withoutReadings = withPiecesOn(withPiecesOn(languages, "main", undefined), "bg", undefined);
  return withoutReadings && structuredClone(withoutReadings);
}

function templateLanguages(
  template: LineTemplate,
  words: readonly WordTiming[] | undefined,
  backgroundWords: readonly WordTiming[] | undefined,
): LineLanguages | undefined {
  const piecesOf = (side: readonly WordTiming[] | undefined, tpl: WordTemplate[] | undefined) =>
    side && tpl
      ? keyedPieces(
          side,
          tpl.map((word) => word.piece),
        )
      : undefined;
  const languages = template.languages && structuredClone(template.languages);
  const main = withPiecesOn(languages, "main", piecesOf(words, template.words));
  return withPiecesOn(main, "bg", piecesOf(backgroundWords, template.backgroundWords));
}

function offsetTemplateWords(words: WordTemplate[], instanceStart: number): WordTiming[] {
  return words.map(({ relativeBegin, relativeEnd, piece: _piece, ...word }) => ({
    ...word,
    id: newWordId(),
    begin: relativeBegin + instanceStart,
    end: relativeEnd + instanceStart,
  }));
}

// -- Exports ------------------------------------------------------------------

export { languagesToTemplate, offsetTemplateWords, templateLanguages, wordsToTemplate };
export type { LinkGroup, WordTemplate, LineTemplate };
