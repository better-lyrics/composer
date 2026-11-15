import { roleWords } from "@/domain/line/track";
import { backgroundText, lineText } from "@/domain/line/text";
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
    lineText(line),
    track?.main.text ?? "",
    roleWords(line, "main"),
    track?.main.pieces,
  );
  if (transliteration) errors.push({ field: "transliteration", message: transliteration });

  const background = backgroundText(line);
  if (background) {
    const backgroundError = validateTransliterationAlignment(
      background,
      track?.bg?.text ?? "",
      roleWords(line, "bg"),
      track?.bg?.pieces,
    );
    if (backgroundError) errors.push({ field: "background-transliteration", message: backgroundError });
  }
  return errors;
}

function getLanguageAlignmentErrorItems(lines: LyricLine[]): LanguageAlignmentErrorItem[] {
  return lines.flatMap((line, lineIndex) => {
    const errors = getLanguageAlignmentErrors(line);
    return errors.length > 0 ? [{ lineId: line.id, lineIndex, text: lineText(line), errors }] : [];
  });
}

export { getLanguageAlignmentErrorItems, getLanguageAlignmentErrors };
export type { LanguageAlignmentError, LanguageAlignmentErrorField };
