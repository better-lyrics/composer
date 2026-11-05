import type { LyricLine } from "@/domain/line/model";
import type { WordTiming } from "@/domain/word/timing";

// Alignment telemetry: what auto-align gave each line, kept on this device and
// sent with the timing the user exported, only when they export and only while
// sharing is on. Used to train future alignment models and to benchmark the
// current ones. Never carries audio or anything that identifies the user.

// -- Types --------------------------------------------------------------------

interface TelemetryWord {
  text: string;
  begin: number;
  end: number;
}

interface TelemetrySpan {
  begin: number;
  end: number;
}

/** One auto-aligned line as the aligner left it. */
interface AlignedLineRecord {
  lineId: string;
  text: string;
  model: { id: string; file: string | null };
  language: string | null;
  /** The user's line timing the aligner was guided by. */
  taps: TelemetrySpan;
  /** The audio the final pass aligned. */
  window: TelemetrySpan;
  /** Whether the window started at the previous line's last word, or came from a search for the line. */
  leadIn: "anchored" | "searched";
  track: "main" | "bg";
  realign: boolean;
  fellBack: boolean;
  guessedWords: string[];
  alignedAt: number;
  aligned: TelemetryWord[];
}

/** One project's collected lines, keyed by line id; a re-aligned line replaces its record. */
interface ProjectTelemetry {
  lines: Record<string, AlignedLineRecord>;
  /** Digest of the last payload sent, so exporting the same timing twice sends it once. */
  lastSent?: string;
}

interface TelemetrySong {
  title: string;
  artists: string[];
  videoId: string | null;
  language: string | null;
}

interface TelemetryPayload {
  schemaVersion: 1;
  installId: string;
  app: { version: string; commit: string };
  song: TelemetrySong;
  lyrics: { textSha256: string; ttmlSha256: string };
  models: string[];
  lines: (AlignedLineRecord & { final: TelemetryWord[] | null })[];
}

interface PayloadInput {
  installId: string;
  app: { version: string; commit: string };
  song: TelemetrySong;
  record: ProjectTelemetry;
  /** The project's lines when it was exported. */
  lines: readonly LyricLine[];
  /** The exported TTML, exactly as written. */
  ttml: string;
}

// -- Functions ----------------------------------------------------------------

function telemetryWords(words: readonly WordTiming[]): TelemetryWord[] {
  return words.map(({ text, begin, end }) => ({ text, begin, end }));
}

/** Lyrics text as hashed: NFC, lower case, whitespace collapsed, one line per lyric line, blank lines dropped. */
function normalizedLyricsText(lines: readonly Pick<LyricLine, "text">[]): string {
  return lines
    .map((line) => line.text.normalize("NFC").toLowerCase().replace(/\s+/gu, " ").trim())
    .filter((text) => text.length > 0)
    .join("\n");
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** The payload for one export, or null when none of the collected lines are still in the song. */
async function buildTelemetryPayload(input: PayloadInput): Promise<TelemetryPayload | null> {
  const byId = new Map(input.lines.map((line) => [line.id, line]));
  const lines = Object.values(input.record.lines).map((record) => {
    const words = byId.get(record.lineId)?.words;
    return { ...record, final: words && words.length > 0 ? telemetryWords(words) : null };
  });
  if (!lines.some((line) => line.final !== null)) return null;
  const [textSha256, ttmlSha256] = await Promise.all([
    sha256Hex(normalizedLyricsText(input.lines)),
    sha256Hex(input.ttml),
  ]);
  return {
    schemaVersion: 1,
    installId: input.installId,
    app: input.app,
    song: input.song,
    lyrics: { textSha256, ttmlSha256 },
    models: [...new Set(lines.map((line) => line.model.id))],
    lines,
  };
}

/** What a payload says about the timing, without the time it was built; equal digests mean nothing new to send. */
function payloadDigest(payload: TelemetryPayload): Promise<string> {
  return sha256Hex(JSON.stringify([payload.installId, payload.lyrics, payload.lines]));
}

// -- Exports ------------------------------------------------------------------

export { buildTelemetryPayload, normalizedLyricsText, payloadDigest, telemetryWords };
export type { AlignedLineRecord, ProjectTelemetry, TelemetrySong };
