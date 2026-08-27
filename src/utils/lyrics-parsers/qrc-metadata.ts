import type { ProjectMetadata } from "@/domain/project/metadata";

// -- Constants ----------------------------------------------------------------

const MS_PER_SECOND = 1000;
const HEADER_TAG_REGEX = /\[([a-z]+):([^\]]*)\]/gi;
const CREDIT_VALUE_REGEX = /[:：]\s*(.*)$/s;
const LATIN_LETTER_REGEX = /[a-z]/i;
const MARKER_MAX_NAME_LENGTH = 40;
const MARKER_MAX_PERFORMERS = 8;
const TRAILING_COLON_REGEX = /[:：]$/;
const COLON_REGEX = /[:：]/;
// The ASCII period is absent on purpose: an initialism carries one, as in "The Notorious B.I.G.".
const MARKER_REJECTED_PUNCTUATION_REGEX = /[,!?;。，！？]/;
const WHITESPACE_REGEX = /\s+/g;
const FALLBACK_CREDIT_KEY = "qrcCredits";
const GROUP_PERFORMER_NAMES = new Set(["合", "合唱", "all"]);
const CREDIT_KEYS_BY_PREFIX = new Map([
  ["lyricsby", "qrcLyricsBy"],
  ["composedby", "qrcComposedBy"],
  ["arrangedby", "qrcArrangedBy"],
  ["producedby", "qrcProducedBy"],
  ["writtenby", "qrcWrittenBy"],
  ["lyricist", "qrcLyricsBy"],
  ["composer", "qrcComposedBy"],
  ["arranger", "qrcArrangedBy"],
  ["producer", "qrcProducedBy"],
  ["mixing", "qrcMixing"],
  ["mastering", "qrcMastering"],
  ["vocal", "qrcVocals"],
  ["vocals", "qrcVocals"],
  ["guitar", "qrcGuitar"],
  ["bass", "qrcBass"],
  ["drums", "qrcDrums"],
  ["作词", "qrcLyricist"],
  ["作曲", "qrcComposer"],
  ["编曲", "qrcArranger"],
  ["編曲", "qrcArranger"],
  ["制作人", "qrcProducer"],
  ["製作人", "qrcProducer"],
  ["混音", "qrcMixing"],
  ["录音", "qrcRecording"],
  ["錄音", "qrcRecording"],
  ["和音", "qrcHarmony"],
  ["吉他", "qrcGuitar"],
  ["演唱", "qrcVocals"],
  ["原唱", "qrcOriginalVocals"],
  ["翻唱", "qrcCoverVocals"],
  ["后期", "qrcPostProduction"],
  ["後期", "qrcPostProduction"],
  ["策划", "qrcPlanning"],
  ["策劃", "qrcPlanning"],
  ["伴奏", "qrcAccompaniment"],
  ["美工", "qrcArtwork"],
  ["海报", "qrcArtwork"],
  ["海報", "qrcArtwork"],
  ["旁白", "qrcNarration"],
]);
// QQ names a CJK role after its head noun, so a prefix nothing above spells out
// is still that role when it ends in one. Bounded because only a role noun is
// this short: without the bound any lyric clause ending in 词 reads as a credit.
const CREDIT_SUFFIX_MAX_LENGTH = 4;
const CREDIT_KEYS_BY_SUFFIX = new Map([
  ["词", "qrcLyricist"],
  ["詞", "qrcLyricist"],
  ["曲", "qrcComposer"],
  ["声", "qrcHarmony"],
  ["聲", "qrcHarmony"],
  ["音", FALLBACK_CREDIT_KEY],
]);
// Authorship, and nothing else: songwriters exports as a songwriter claim. A
// producer, mixer or guitarist is a real contributor whose line is read and kept
// in extra, but naming them a writer is a claim the document never made.
const WRITING_CREDIT_KEYS = new Set([
  "qrcLyricsBy",
  "qrcComposedBy",
  "qrcArrangedBy",
  "qrcWrittenBy",
  "qrcLyricist",
  "qrcComposer",
  "qrcArranger",
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

// Everything before the first colon, with its spacing and casing normalised away.
// Taking the whole run is what anchors the match: "Song lyrics by：X" reads as
// the prefix "songlyricsby", which names no role.
function creditRoleKey(text: string): string | null {
  const colonIndex = text.search(COLON_REGEX);
  if (colonIndex === -1) return null;

  const prefix = text.slice(0, colonIndex).replace(WHITESPACE_REGEX, "").toLowerCase();
  if (prefix.length === 0) return null;

  const named = CREDIT_KEYS_BY_PREFIX.get(prefix);
  if (named !== undefined) return named;
  if (prefix.length > CREDIT_SUFFIX_MAX_LENGTH) return null;

  for (const [suffix, key] of CREDIT_KEYS_BY_SUFFIX) {
    if (prefix.endsWith(suffix)) return key;
  }
  return null;
}

function isCreditLine(text: string): boolean {
  return creditRoleKey(text) !== null;
}

// The fallback keeps a credit whose role has no name of its own out of the
// lyrics and in metadata, rather than dropping it.
function creditExtraKey(text: string): string {
  return creditRoleKey(text) ?? FALLBACK_CREDIT_KEY;
}

function isWritingCreditKey(key: string): boolean {
  return WRITING_CREDIT_KEYS.has(key);
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
  return text.replace(WHITESPACE_REGEX, "").toLowerCase();
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

function isGroupPerformerName(name: string): boolean {
  return GROUP_PERFORMER_NAMES.has(name.toLowerCase());
}

// -- Exports ------------------------------------------------------------------

export {
  creditExtraKey,
  creditValue,
  decodeCredits,
  isCreditLine,
  isGroupPerformerName,
  isQrcTitleLine,
  isWritingCreditKey,
  MS_PER_SECOND,
  parseHeaderTags,
  readSingerMarker,
};
