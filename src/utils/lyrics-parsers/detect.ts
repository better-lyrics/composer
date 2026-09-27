import { QRC_LINE_HEADER_REGEX } from "@/domain/lyrics-file/qrc-syntax";
import { LRC_METADATA_TAG_REGEX } from "@/utils/lyrics-parsers/lrc";

// -- Types --------------------------------------------------------------------

type LyricsFileType = "txt" | "lrc" | "srt" | "ttml" | "qrc" | "unknown";

// -- Helpers ------------------------------------------------------------------

function opensWithLrcTimestamp(content: string): boolean {
  const firstLyricLine = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length > 0 && !LRC_METADATA_TAG_REGEX.test(line));
  return firstLyricLine !== undefined && /^\[\d{1,2}:\d{2}/.test(firstLyricLine);
}

// -- Detection ----------------------------------------------------------------

function detectFileType(filename: string, content: string): LyricsFileType {
  const ext = filename.toLowerCase().split(".").pop();
  if (ext === "txt") return "txt";
  if (ext === "lrc") return "lrc";
  if (ext === "srt") return "srt";
  if (ext === "qrc") return "qrc";
  if (ext === "ttml" || ext === "xml") {
    if (content.includes("<QrcInfos")) return "qrc";
    if (content.includes("<tt") || content.includes("xmlns:tt")) {
      return "ttml";
    }
  }
  // Try to detect by content
  if (content.includes("<tt") || content.includes("xmlns:tt")) return "ttml";
  if (opensWithLrcTimestamp(content)) return "lrc";
  // SRT is matched before QRC: subtitle text may contain a bracketed pair, while a
  // QRC document can never open with a cue number and timecode.
  if (/^\d+\r?\n\d{2}:\d{2}:\d{2}/.test(content)) return "srt";
  if (QRC_LINE_HEADER_REGEX.test(content)) return "qrc";
  return "txt";
}

// -- Exports ------------------------------------------------------------------

export { detectFileType };
export type { LyricsFileType };
