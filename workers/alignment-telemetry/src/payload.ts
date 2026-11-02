// The one payload shape the worker stores. Anything else is rejected, so a
// client bug can never smuggle extra fields (audio above all) into the bucket.

// -- Types --------------------------------------------------------------------

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

interface Check {
  ok: boolean;
  error?: string;
}

// -- Constants ----------------------------------------------------------------

const SCHEMA_VERSION = 1;
const INSTALL_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const SHA256_HEX = /^[0-9a-f]{64}$/;
const MAX_LINES = 2000;
const MAX_WORDS = 400;
const MAX_TEXT = 2000;
const MAX_SHORT = 200;
const MAX_SECONDS = 24 * 60 * 60;

const TOP_KEYS = ["schemaVersion", "installId", "app", "song", "lyrics", "models", "lines"];
const LINE_KEYS = [
  "lineId",
  "text",
  "model",
  "language",
  "taps",
  "window",
  "leadIn",
  "track",
  "realign",
  "fellBack",
  "guessedWords",
  "alignedAt",
  "aligned",
  "final",
];

// -- Helpers ------------------------------------------------------------------

function isObject(value: Json | undefined): value is { [key: string]: Json } {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnly(value: { [key: string]: Json }, keys: readonly string[]): boolean {
  return Object.keys(value).every((key) => keys.includes(key));
}

function isText(value: Json | undefined, max: number): value is string {
  return typeof value === "string" && value.length <= max;
}

function isSeconds(value: Json | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= MAX_SECONDS;
}

function isSpan(value: Json | undefined): boolean {
  return isObject(value) && hasOnly(value, ["begin", "end"]) && isSeconds(value.begin) && isSeconds(value.end);
}

function isTextList(value: Json | undefined, maxItems: number, maxLength: number): boolean {
  return Array.isArray(value) && value.length <= maxItems && value.every((item) => isText(item, maxLength));
}

function isWords(value: Json | undefined): boolean {
  return (
    Array.isArray(value) &&
    value.length <= MAX_WORDS &&
    value.every(
      (word) =>
        isObject(word) &&
        hasOnly(word, ["text", "begin", "end"]) &&
        isText(word.text, MAX_SHORT) &&
        isSeconds(word.begin) &&
        isSeconds(word.end),
    )
  );
}

function isNullableText(value: Json | undefined, max: number): boolean {
  return value === null || isText(value, max);
}

function lineError(line: Json): string | null {
  if (!isObject(line) || !hasOnly(line, LINE_KEYS)) return "line has unknown fields";
  const model = line.model;
  if (!isText(line.lineId, MAX_SHORT) || !isText(line.text, MAX_TEXT)) return "line id or text";
  if (!isObject(model) || !hasOnly(model, ["id", "file"]) || !isText(model.id, MAX_SHORT)) return "line model";
  if (!isNullableText(model.file, MAX_SHORT) || !isNullableText(line.language, 35)) return "line model or language";
  if (!isSpan(line.taps) || !isSpan(line.window)) return "line taps or window";
  if (line.leadIn !== "anchored" && line.leadIn !== "searched") return "line leadIn";
  if (line.track !== "main" && line.track !== "bg") return "line track";
  if (typeof line.realign !== "boolean" || typeof line.fellBack !== "boolean") return "line flags";
  if (!isTextList(line.guessedWords, MAX_WORDS, MAX_SHORT)) return "line guessedWords";
  if (typeof line.alignedAt !== "number" || !Number.isFinite(line.alignedAt)) return "line alignedAt";
  if (!isWords(line.aligned)) return "line aligned";
  if (line.final !== null && !isWords(line.final)) return "line final";
  return null;
}

// -- Validation ---------------------------------------------------------------

function isInstallId(value: unknown): value is string {
  return typeof value === "string" && INSTALL_ID.test(value);
}

function checkPayload(body: Json): Check {
  if (!isObject(body) || !hasOnly(body, TOP_KEYS)) return { ok: false, error: "unknown top-level fields" };
  if (body.schemaVersion !== SCHEMA_VERSION) return { ok: false, error: "schemaVersion" };
  if (!isInstallId(body.installId)) return { ok: false, error: "installId" };
  const { app, song, lyrics } = body;
  if (!isObject(app) || !hasOnly(app, ["version", "commit"])) return { ok: false, error: "app" };
  if (!isText(app.version, MAX_SHORT) || !isText(app.commit, MAX_SHORT)) return { ok: false, error: "app" };
  if (!isObject(song) || !hasOnly(song, ["title", "artists", "videoId", "language"]))
    return { ok: false, error: "song" };
  if (!isText(song.title, MAX_TEXT) || !isTextList(song.artists, 50, MAX_SHORT)) return { ok: false, error: "song" };
  if (!isNullableText(song.videoId, 20) || !isNullableText(song.language, 35)) return { ok: false, error: "song" };
  if (!isObject(lyrics) || !hasOnly(lyrics, ["textSha256", "ttmlSha256"])) return { ok: false, error: "lyrics" };
  if (!isText(lyrics.textSha256, 64) || !SHA256_HEX.test(lyrics.textSha256)) return { ok: false, error: "lyrics" };
  if (!isText(lyrics.ttmlSha256, 64) || !SHA256_HEX.test(lyrics.ttmlSha256)) return { ok: false, error: "lyrics" };
  if (!isTextList(body.models, 20, MAX_SHORT)) return { ok: false, error: "models" };
  const lines = body.lines;
  if (!Array.isArray(lines) || lines.length === 0 || lines.length > MAX_LINES) return { ok: false, error: "lines" };
  for (const line of lines) {
    const error = lineError(line);
    if (error) return { ok: false, error };
  }
  return { ok: true };
}

// -- Exports ------------------------------------------------------------------

export { checkPayload, isInstallId };
export type { Json };
