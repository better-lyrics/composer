import { QRC_LINE_HEADER_REGEX, QRC_WORD_TAG_REGEX } from "@/domain/lyrics-file/qrc-syntax";
import type { ProjectFileContents } from "@/lib/project-file-read";
import { PARSERS } from "@/utils/lyrics-parsers";
import { type LyricsFileType, detectFileType } from "@/utils/lyrics-parsers/detect";
import type { ParseResult } from "@/utils/lyrics-parsers/shared";
import { readProjectFileText } from "@/views/lyrics-import-modal/import-lyrics-source";

// -- Types --------------------------------------------------------------------

type PastedText =
  | { kind: "project-file"; contents: ProjectFileContents }
  | { kind: "lyrics-file"; parsed: ParseResult }
  | { kind: "typed-text" };

// -- Constants ----------------------------------------------------------------

const TYPED_TEXT: PastedText = { kind: "typed-text" };
const LEADING_BOM_AND_BLANK_LINES = /^\uFEFF?(?:[ \t]*\r?\n)*/;
const TTML_DOCUMENT_START = /^\s*(?:<\?xml[^>]*\?>\s*)?(?:<!--[\s\S]*?-->\s*)*<tt[\s>]/;
const QRC_LINE_AT_LINE_START = new RegExp(`^\\s*${QRC_LINE_HEADER_REGEX.source}`, "m");

// -- Helpers ------------------------------------------------------------------

// File sniffing finds a format anywhere in the text; a paste only counts when the text reads as a whole document.
function readsAsWholeDocument(fileType: LyricsFileType, text: string): boolean {
  if (fileType === "ttml") return TTML_DOCUMENT_START.test(text);
  if (fileType === "qrc") {
    return text.includes("<QrcInfos") || (QRC_LINE_AT_LINE_START.test(text) && QRC_WORD_TAG_REGEX.test(text));
  }
  return fileType === "lrc" || fileType === "srt";
}

// -- Classification -----------------------------------------------------------

function classifyPastedText(text: string, fallbackDuration?: number): PastedText {
  const contents = readProjectFileText(text);
  if (contents) return { kind: "project-file", contents };
  const body = text.replace(LEADING_BOM_AND_BLANK_LINES, "");
  const fileType = detectFileType("", body);
  if (fileType === "txt" || fileType === "unknown" || !readsAsWholeDocument(fileType, body)) return TYPED_TEXT;
  const parsed = PARSERS[fileType](body, fallbackDuration);
  return parsed.lines.length > 0 ? { kind: "lyrics-file", parsed } : TYPED_TEXT;
}

// -- Exports ------------------------------------------------------------------

export { classifyPastedText };
