import type { LanguagePiece, LanguagePieces, LineLanguages } from "insync/language";
import { keyedPieces, pieceOf } from "@/domain/language/pieces";
import { withPiecesOn } from "@/domain/language/side-pieces";
import type { LineFields } from "@/domain/line/line-from-fields";
import type { LinePassthrough } from "@/domain/line/passthrough";
import { newWordId } from "@/domain/word/id";
import type { WordTiming } from "insync/word-timing";

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
  /** A line-synced background travels as its one block in `backgroundWords` and lands as a span again. */
  backgroundLineSynced?: true;
  /** Pieces stay on the template words, so they follow the words to their new ids. */
  languages?: LineLanguages;
  passthrough?: LinePassthrough;
}

// Keep exact alternate fragments and separators when moving between absolute
// timings and templates; an empty string is meaningful for both fields.
function wordsToTemplate(words: WordTiming[], instanceStart: number, pieces?: LanguagePieces): WordTemplate[] {
  return words.map(({ id, begin, end, ...word }) => {
    const piece = pieceOf(pieces, { id });
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

// The background fields of a line made from a template, its words already placed at the instance start.
function templateBackgroundFields(template: LineTemplate, words: WordTiming[] | undefined): Partial<LineFields> {
  const [block, ...rest] = words ?? [];
  const span = template.backgroundLineSynced && block && rest.length === 0;
  return {
    ...(template.backgroundText !== undefined && { backgroundText: template.backgroundText }),
    ...(template.backgroundTextSource !== undefined && { backgroundTextSource: template.backgroundTextSource }),
    ...(span
      ? { backgroundBegin: block.begin, backgroundEnd: block.end, ...(block.explicit && { backgroundExplicit: true }) }
      : words && { backgroundWords: words }),
  };
}

// -- Exports ------------------------------------------------------------------

export { languagesToTemplate, offsetTemplateWords, templateBackgroundFields, templateLanguages, wordsToTemplate };
export type { LinkGroup, WordTemplate, LineTemplate };
