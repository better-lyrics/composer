import { detectFileType } from "@/utils/lyrics-parsers/detect";
import { parseLrc } from "@/utils/lyrics-parsers/lrc";
import type { ParseResult } from "@/utils/lyrics-parsers/shared";
import { parseSrt } from "@/utils/lyrics-parsers/srt";
import { parseTtml } from "@/utils/lyrics-parsers/ttml";
import { parseTxt } from "@/utils/lyrics-parsers/txt";

// -- Main Parser --------------------------------------------------------------

function parseLyricsFile(filename: string, content: string, fallbackDuration?: number): ParseResult {
  const fileType = detectFileType(filename, content);

  switch (fileType) {
    case "lrc":
      return parseLrc(content, fallbackDuration);
    case "srt":
      return parseSrt(content);
    case "ttml":
      return parseTtml(content);
    default:
      return parseTxt(content);
  }
}

// -- Exports ------------------------------------------------------------------

export { parseLyricsFile };
export type { ParseResult };
