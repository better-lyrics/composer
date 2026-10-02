import { writeLrc } from "@/utils/lyrics-writers/lrc";
import { writeQrc } from "@/utils/lyrics-writers/qrc";
import type { LyricsWriterInput } from "@/utils/lyrics-writers/shared";
import { writeSrt } from "@/utils/lyrics-writers/srt";
import { generateTTML } from "@/utils/ttml";

// -- Types --------------------------------------------------------------------

interface OutputFormat {
  label: string;
  extension: string;
  mimeType: string;
  write: (document: LyricsWriterInput) => string;
}

// -- Constants ----------------------------------------------------------------

const TTML_OUTPUT: OutputFormat = {
  label: "TTML",
  extension: "ttml",
  mimeType: "application/ttml+xml",
  write: generateTTML,
};
const LRC_OUTPUT: OutputFormat = { label: "LRC", extension: "lrc", mimeType: "text/plain", write: writeLrc };
const SRT_OUTPUT: OutputFormat = { label: "SRT", extension: "srt", mimeType: "application/x-subrip", write: writeSrt };
const QRC_OUTPUT: OutputFormat = { label: "QRC", extension: "qrc", mimeType: "text/plain", write: writeQrc };

// -- Exports ------------------------------------------------------------------

export { LRC_OUTPUT, QRC_OUTPUT, SRT_OUTPUT, TTML_OUTPUT };
export type { OutputFormat };
