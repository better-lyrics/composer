import { QRC_LINE_HEADER_REGEX } from "@/domain/lyrics-file/qrc-syntax";
import { LRC_METADATA_TAG_REGEX } from "@/utils/lyrics-parsers/lrc";

// -- Types --------------------------------------------------------------------

type LyricsFileType = "txt" | "lrc" | "srt" | "ttml" | "qrc" | "unknown";

// -- Helpers ------------------------------------------------------------------

const LRC_TIMESTAMP_LINE = /^\[\d{1,2}:\d{2}/;
const MIN_TIMED_LINES_AFTER_PREAMBLE = 3;
const RTF_DOCUMENT_START = /^\uFEFF?\s*\{\\rtf/;

// A title or exported header may come before the timestamps, as long as at least half of what follows is timed.
function readsAsLrc(content: string): boolean {
  const lyricLines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !LRC_METADATA_TAG_REGEX.test(line));
  const firstTimed = lyricLines.findIndex((line) => LRC_TIMESTAMP_LINE.test(line));
  if (firstTimed < 0) return false;
  const fromFirstTimed = lyricLines.slice(firstTimed);
  const timedCount = fromFirstTimed.filter((line) => LRC_TIMESTAMP_LINE.test(line)).length;
  if (firstTimed > 0 && timedCount < MIN_TIMED_LINES_AFTER_PREAMBLE) return false;
  return timedCount * 2 >= fromFirstTimed.length;
}

// -- Detection ----------------------------------------------------------------

function detectFileType(filename: string, content: string): LyricsFileType {
  if (RTF_DOCUMENT_START.test(content)) return "txt";
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
  if (readsAsLrc(content)) return "lrc";
  // SRT is matched before QRC: subtitle text may contain a bracketed pair, while a
  // QRC document can never open with a cue number and timecode.
  if (/^\d+\r?\n\d{2}:\d{2}:\d{2}/.test(content)) return "srt";
  if (QRC_LINE_HEADER_REGEX.test(content)) return "qrc";
  return "txt";
}

// -- Exports ------------------------------------------------------------------

export { detectFileType };
export type { LyricsFileType };
