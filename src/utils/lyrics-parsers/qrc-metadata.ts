import type { ProjectMetadata } from "@/domain/project/metadata";
import { MS_PER_SECOND } from "@/utils/lyrics-parsers/qrc";
import { stripSplitCharacter } from "@/utils/split-character";

// -- Constants ----------------------------------------------------------------

const HEADER_TAG_REGEX = /\[([a-z]+):([^\]]*)\]/gi;
const CREDIT_PREFIX_REGEX =
  /^(lyrics|composed|arranged|produced|written)\s*by\s*[:：]|^(作词|作曲|编曲|編曲|制作人|製作人)\s*[:：]/i;
const CREDIT_VALUE_REGEX = /[:：]\s*(.*)$/s;
const LATIN_LETTER_REGEX = /[a-z]/i;
const MARKER_MAX_NAME_LENGTH = 40;
const TRAILING_COLON_REGEX = /[:：]$/;
const COLON_REGEX = /[:：]/;
const SENTENCE_PUNCTUATION_REGEX = /[.,!?;。，！？]/;
const FALLBACK_CREDIT_KEY = "qrcCredits";
const CREDIT_EXTRA_KEYS = new Map([
  ["lyrics", "qrcLyricsBy"],
  ["composed", "qrcComposedBy"],
  ["arranged", "qrcArrangedBy"],
  ["produced", "qrcProducedBy"],
  ["written", "qrcWrittenBy"],
  ["作词", "qrcLyricist"],
  ["作曲", "qrcComposer"],
  ["编曲", "qrcArranger"],
  ["編曲", "qrcArranger"],
  ["制作人", "qrcProducer"],
  ["製作人", "qrcProducer"],
]);

// -- Types --------------------------------------------------------------------

interface HeaderTags {
  metadata: Partial<ProjectMetadata>;
  offsetSeconds: number;
}

// -- Header tags --------------------------------------------------------------

function parseHeaderTags(lyricContent: string): HeaderTags {
  const metadata: Partial<ProjectMetadata> = {};
  const extra: Record<string, string> = {};
  let offsetSeconds = 0;

  for (const match of lyricContent.matchAll(HEADER_TAG_REGEX)) {
    const tag = match[1].toLowerCase();
    const value = match[2].trim();
    if (tag === "ti" && value) metadata.title = value;
    else if (tag === "ar" && value) metadata.artists = [value];
    else if (tag === "al" && value) metadata.album = value;
    else if (tag === "by" && value) extra.qrcTranscriber = value;
    else if (tag === "offset") {
      const parsed = Number.parseInt(value, 10);
      if (Number.isFinite(parsed)) offsetSeconds = parsed / MS_PER_SECOND;
    }
  }

  if (Object.keys(extra).length > 0) metadata.extra = extra;
  return { metadata, offsetSeconds };
}

// -- Credits ------------------------------------------------------------------

function isCreditLine(text: string): boolean {
  return CREDIT_PREFIX_REGEX.test(text.trim());
}

function creditExtraKey(text: string): string {
  const match = CREDIT_PREFIX_REGEX.exec(text.trim());
  const prefix = match?.[1] ?? match?.[2] ?? "";
  return CREDIT_EXTRA_KEYS.get(prefix.toLowerCase()) ?? FALLBACK_CREDIT_KEY;
}

function creditValue(text: string): string {
  return stripSplitCharacter(text).match(CREDIT_VALUE_REGEX)?.[1].trim() ?? "";
}

// A token with no Latin letters is left alone so CJK names survive intact.
function titleCaseToken(token: string): string {
  return token
    .split(/\s+/)
    .map((part) => (LATIN_LETTER_REGEX.test(part) ? part.charAt(0).toUpperCase() + part.slice(1).toLowerCase() : part))
    .join(" ");
}

function decodeCredits(value: string): string[] {
  const tokens = value
    .split("/")
    .map((token) => token.trim())
    .filter((token) => token.length > 0)
    .map(titleCaseToken);

  if (tokens.length % 2 !== 0) return tokens;

  const names: string[] = [];
  for (let index = 0; index < tokens.length; index += 2) {
    names.push(`${tokens[index + 1]} ${tokens[index]}`);
  }
  return names;
}

// -- Title line ---------------------------------------------------------------

function normalizeTitleLine(text: string): string {
  return stripSplitCharacter(text).replace(/\s+/g, "").toLowerCase();
}

function isQrcTitleLine(text: string, tags: Partial<ProjectMetadata>): boolean {
  const artist = tags.artists?.[0];
  if (!tags.title || !artist) return false;
  return normalizeTitleLine(text) === normalizeTitleLine(`${tags.title} - ${artist}`);
}

// -- Singer markers -----------------------------------------------------------

function readSingerMarker(text: string): string | null {
  const trimmed = text.trim();
  if (!TRAILING_COLON_REGEX.test(trimmed)) return null;

  const name = trimmed.slice(0, -1).trim();
  if (name.length === 0 || name.length > MARKER_MAX_NAME_LENGTH) return null;
  if (SENTENCE_PUNCTUATION_REGEX.test(name) || COLON_REGEX.test(name)) return null;
  return name;
}

// -- Exports ------------------------------------------------------------------

export { creditExtraKey, creditValue, decodeCredits, isCreditLine, isQrcTitleLine, parseHeaderTags, readSingerMarker };
