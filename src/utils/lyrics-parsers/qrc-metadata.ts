import type { ProjectMetadata } from "@/domain/project/metadata";

// -- Constants ----------------------------------------------------------------

const MS_PER_SECOND = 1000;
const HEADER_TAG_REGEX = /\[([a-z]+):([^\]]*)\]/gi;
const CREDIT_PREFIX_REGEX =
  /^(lyrics|composed|arranged|produced|written)\s*by\s*[:：]|^(lyricist|composer|arranger|producer|作词|作曲|编曲|編曲|制作人|製作人)\s*[:：]/i;
const CREDIT_VALUE_REGEX = /[:：]\s*(.*)$/s;
const LATIN_LETTER_REGEX = /[a-z]/i;
const MARKER_MAX_NAME_LENGTH = 40;
const MARKER_MAX_PERFORMERS = 8;
const TRAILING_COLON_REGEX = /[:：]$/;
const COLON_REGEX = /[:：]/;
// The ASCII period is absent on purpose: an initialism carries one, as in "The Notorious B.I.G.".
const MARKER_REJECTED_PUNCTUATION_REGEX = /[,!?;。，！？]/;
const FALLBACK_CREDIT_KEY = "qrcCredits";
const CREDIT_EXTRA_KEYS = new Map([
  ["lyrics", "qrcLyricsBy"],
  ["composed", "qrcComposedBy"],
  ["arranged", "qrcArrangedBy"],
  ["produced", "qrcProducedBy"],
  ["written", "qrcWrittenBy"],
  ["lyricist", "qrcLyricsBy"],
  ["composer", "qrcComposedBy"],
  ["arranger", "qrcArrangedBy"],
  ["producer", "qrcProducedBy"],
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

// -- Slash lists --------------------------------------------------------------

// QQ delimits with a slash; its meaning is the caller's business, but qrc.ts keys agents on its absence from members.
function splitSlashList(value: string): string[] {
  return value
    .split("/")
    .map((name) => name.trim())
    .filter((name) => name.length > 0);
}

// -- Credits ------------------------------------------------------------------

function isCreditLine(text: string): boolean {
  return CREDIT_PREFIX_REGEX.test(text.trim());
}

// The fallback catches a prefix added to CREDIT_PREFIX_REGEX but not to
// CREDIT_EXTRA_KEYS, so a new prefix degrades to a generic key instead of
// silently dropping the credit.
function creditExtraKey(text: string): string {
  const match = CREDIT_PREFIX_REGEX.exec(text.trim());
  const prefix = match?.[1] ?? match?.[2] ?? "";
  return CREDIT_EXTRA_KEYS.get(prefix.toLowerCase()) ?? FALLBACK_CREDIT_KEY;
}

function creditValue(text: string): string {
  return text.match(CREDIT_VALUE_REGEX)?.[1].trim() ?? "";
}

// The Latin test is load-bearing: "周杰倫" === "周杰倫".toUpperCase() is true.
function isAllCapsLatinToken(token: string): boolean {
  return LATIN_LETTER_REGEX.test(token) && token === token.toUpperCase();
}

// MCCARTNEY reads back as Mccartney: inner capitals need a name dictionary to recover.
function titleCaseIfAllCaps(token: string): string {
  if (!isAllCapsLatinToken(token)) return token;
  return token
    .split(/\s+/)
    .map((part) => (LATIN_LETTER_REGEX.test(part) ? part.charAt(0).toUpperCase() + part.slice(1).toLowerCase() : part))
    .join(" ");
}

// QQ writes SURNAME/GIVENNAME only in all caps, so the casing of the list as a whole says which
// convention is in force. Off that convention, both re-casing a name and pairing one invent people.
function decodeCredits(value: string): string[] {
  const tokens = splitSlashList(value);

  const latinTokens = tokens.filter((token) => LATIN_LETTER_REGEX.test(token));
  const allCapsConvention = latinTokens.length > 0 && latinTokens.every(isAllCapsLatinToken);
  const names = allCapsConvention ? tokens.map(titleCaseIfAllCaps) : tokens;

  const pairable = allCapsConvention && tokens.length % 2 === 0 && tokens.every(isAllCapsLatinToken);
  if (!pairable) return names;

  const paired: string[] = [];
  for (let index = 0; index < names.length; index += 2) {
    paired.push(`${names[index + 1]} ${names[index]}`);
  }
  return paired;
}

// -- Title line ---------------------------------------------------------------

function normalizeTitleLine(text: string): string {
  return text.replace(/\s+/g, "").toLowerCase();
}

function isQrcTitleLine(text: string, tags: Partial<ProjectMetadata>): boolean {
  const artist = tags.artists?.[0];
  if (!tags.title || !artist) return false;
  return normalizeTitleLine(text) === normalizeTitleLine(`${tags.title} - ${artist}`);
}

// -- Singer markers -----------------------------------------------------------

function dedupeIgnoringCase(names: string[]): string[] {
  const byFoldedName = new Map<string, string>();
  for (const name of names) {
    const key = name.toLowerCase();
    if (!byFoldedName.has(key)) byFoldedName.set(key, name);
  }
  return [...byFoldedName.values()];
}

// The length bound is per performer: a duet marker is no less a marker for being twice as long.
// The count bound replaces the ceiling that per-performer lengths alone no longer impose.
function readSingerMarker(text: string): string[] | null {
  const trimmed = text.trim();
  if (!TRAILING_COLON_REGEX.test(trimmed)) return null;

  const body = trimmed.slice(0, -1);
  if (MARKER_REJECTED_PUNCTUATION_REGEX.test(body) || COLON_REGEX.test(body)) return null;

  const performers = dedupeIgnoringCase(splitSlashList(body));
  if (performers.length === 0 || performers.length > MARKER_MAX_PERFORMERS) return null;
  if (performers.some((performer) => performer.length > MARKER_MAX_NAME_LENGTH)) return null;
  return performers;
}

// -- Exports ------------------------------------------------------------------

export {
  creditExtraKey,
  creditValue,
  decodeCredits,
  isCreditLine,
  isQrcTitleLine,
  MS_PER_SECOND,
  parseHeaderTags,
  readSingerMarker,
};
