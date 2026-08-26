// -- Types --------------------------------------------------------------------

type LyricsFileType = "txt" | "lrc" | "srt" | "ttml" | "qrc" | "unknown";

// -- Constants ----------------------------------------------------------------

const QRC_LINE_HEADER_REGEX = /\[\d+,\d+\]/;

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
  if (/^\[\d{1,2}:\d{2}/.test(content)) return "lrc";
  // SRT is matched before QRC: subtitle text may contain a bracketed pair, while a
  // QRC document can never open with a cue number and timecode.
  if (/^\d+\r?\n\d{2}:\d{2}:\d{2}/.test(content)) return "srt";
  if (QRC_LINE_HEADER_REGEX.test(content)) return "qrc";
  return "txt";
}

// -- Exports ------------------------------------------------------------------

export { detectFileType };
export type { LyricsFileType };
