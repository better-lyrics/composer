import { roleWords } from "./line-track";
import { backgroundText, lineText } from "./line-text";
import { validateTransliterationAlignment } from "./language-align";
import { lineTransliteration } from "./language-line-languages";
import type { LyricLine } from "./line";

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

function getLanguageAlignmentErrors(line: LyricLine, splitChar: string): LanguageAlignmentError[] {
  const errors: LanguageAlignmentError[] = [];
  const track = lineTransliteration(line);
  const transliteration = validateTransliterationAlignment(
    lineText(line, splitChar),
    track?.main.text ?? "",
    roleWords(line, "main"),
    track?.main.pieces,
  );
  if (transliteration) errors.push({ field: "transliteration", message: transliteration });

  const background = backgroundText(line, splitChar);
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

function getLanguageAlignmentErrorItems(lines: LyricLine[], splitChar: string): LanguageAlignmentErrorItem[] {
  return lines.flatMap((line, lineIndex) => {
    const errors = getLanguageAlignmentErrors(line, splitChar);
    return errors.length > 0 ? [{ lineId: line.id, lineIndex, text: lineText(line, splitChar), errors }] : [];
  });
}

export { getLanguageAlignmentErrorItems, getLanguageAlignmentErrors };
export type { LanguageAlignmentErrorField };
