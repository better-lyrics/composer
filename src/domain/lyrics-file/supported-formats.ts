import type { LyricsFileType } from "@/utils/lyrics-parsers/detect";

// -- Types ---------------------------------------------------------------------

interface SupportedLyricsFormat {
  extension: Exclude<LyricsFileType, "unknown">;
  label: string;
  description: string;
}

// -- Declaration ---------------------------------------------------------------

const SUPPORTED_LYRICS_FORMATS: readonly SupportedLyricsFormat[] = [
  { extension: "txt", label: ".txt", description: "plain text" },
  { extension: "lrc", label: ".lrc", description: "line-level timing" },
  { extension: "srt", label: ".srt", description: "subtitles" },
  { extension: "ttml", label: ".ttml", description: "full timing + agents" },
  { extension: "qrc", label: ".qrc", description: "QQ Music word timing" },
];

// .xml is a container extension, not a format: detectFileType resolves it to
// TTML or QRC by sniffing content, so it is accepted but never advertised.
const ALIAS_LYRICS_EXTENSIONS: readonly string[] = ["xml"];

// -- Derived -------------------------------------------------------------------

const ACCEPTED_LYRICS_EXTENSIONS: ReadonlySet<string> = new Set([
  ...SUPPORTED_LYRICS_FORMATS.map((format) => format.extension),
  ...ALIAS_LYRICS_EXTENSIONS,
]);

const LYRICS_FILE_ACCEPT_ATTRIBUTE = [...ACCEPTED_LYRICS_EXTENSIONS].map((ext) => `.${ext}`).join(",");

const LYRICS_FORMATS_COMPACT = SUPPORTED_LYRICS_FORMATS.map((format) => format.label).join(" ");

const LYRICS_FORMATS_PROSE = SUPPORTED_LYRICS_FORMATS.map((format) => format.label).join(", ");

const LYRICS_FORMATS_DESCRIBED = SUPPORTED_LYRICS_FORMATS.map(
  (format) => `${format.label} (${format.description})`,
).join(", ");

const UNSUPPORTED_LYRICS_FILE_MESSAGE = `Unsupported file type. Use ${LYRICS_FORMATS_COMPACT}`;

// -- Predicate -----------------------------------------------------------------

function isSupportedLyricsFile(filename: string): boolean {
  const lastDot = filename.lastIndexOf(".");
  if (lastDot === -1) return false;
  return ACCEPTED_LYRICS_EXTENSIONS.has(filename.slice(lastDot + 1).toLowerCase());
}

// -- Exports -------------------------------------------------------------------

export {
  ALIAS_LYRICS_EXTENSIONS,
  isSupportedLyricsFile,
  LYRICS_FILE_ACCEPT_ATTRIBUTE,
  LYRICS_FORMATS_COMPACT,
  LYRICS_FORMATS_DESCRIBED,
  LYRICS_FORMATS_PROSE,
  SUPPORTED_LYRICS_FORMATS,
  UNSUPPORTED_LYRICS_FILE_MESSAGE,
};
