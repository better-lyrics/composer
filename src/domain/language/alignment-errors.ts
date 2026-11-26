import { validateTransliterationAlignment } from "@/domain/language/align";
import { lineTransliteration } from "@/domain/language/line-languages";
import type { LyricLine } from "@/domain/line/model";

type LanguageAlignmentErrorField = "transliteration" | "background-transliteration";

interface LanguageAlignmentError {
  field: LanguageAlignmentErrorField;
  message: string;
}

interface LanguageAlignmentErrorItem {
  lineId: string;
  lineIndex: number;
  text: string;
  errors: LanguageAlignmentError[];
}

function getLanguageAlignmentErrors(line: LyricLine): LanguageAlignmentError[] {
  const errors: LanguageAlignmentError[] = [];
  const track = lineTransliteration(line);
  const transliteration = validateTransliterationAlignment(
    line.text,
    track?.main.text ?? "",
    line.words,
    track?.main.pieces,
  );
  if (transliteration) errors.push({ field: "transliteration", message: transliteration });

  if (line.backgroundText) {
    const background = validateTransliterationAlignment(
      line.backgroundText,
      track?.bg?.text ?? "",
      line.backgroundWords,
      track?.bg?.pieces,
    );
    if (background) errors.push({ field: "background-transliteration", message: background });
  }
  return errors;
}

function getLanguageAlignmentErrorItems(lines: LyricLine[]): LanguageAlignmentErrorItem[] {
  return lines.flatMap((line, lineIndex) => {
    const errors = getLanguageAlignmentErrors(line);
    return errors.length > 0 ? [{ lineId: line.id, lineIndex, text: line.text, errors }] : [];
  });
}

export { getLanguageAlignmentErrorItems, getLanguageAlignmentErrors };
export type { LanguageAlignmentError, LanguageAlignmentErrorField };
