import { PARSERS } from "@/utils/lyrics-parsers";
import { detectFileType } from "@/utils/lyrics-parsers/detect";
import { readProjectFileText } from "@/views/lyrics-import-modal/import-lyrics-source";

// -- Types --------------------------------------------------------------------

type PastedTextKind = "project-file" | "lyrics-file" | "typed-text";

// -- Classification -----------------------------------------------------------

function classifyPastedText(text: string): PastedTextKind {
  if (readProjectFileText(text)) return "project-file";
  const fileType = detectFileType("", text);
  if (fileType === "txt" || fileType === "unknown") return "typed-text";
  return PARSERS[fileType](text).lines.length > 0 ? "lyrics-file" : "typed-text";
}

// -- Exports ------------------------------------------------------------------

export { classifyPastedText };
