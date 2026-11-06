// -- Types --------------------------------------------------------------------

interface AlignmentCounts {
  untouched: number;
  heard: number;
  fixed: number;
  handSynced: number;
}

interface BuildTag extends AlignmentCounts {
  handEdited: boolean;
}

// -- Constants ----------------------------------------------------------------

const COUNT_LIMIT = 512;
const CHECK_LIMIT = 16;
const TAG_SPACE = 2 ** 41;
const TAG_LENGTH = 8;
const ROOT_OPEN = /<tt\b[^>]*/;
const BUILD_ATTRIBUTE = /\scomposer:build="([0-9a-z]{8})"/;

// -- Functions ----------------------------------------------------------------

function fnv1a(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 0x01000193) >>> 0;
  return hash;
}

function occurrences(text: string, part: string): number {
  return text.split(part).length - 1;
}

function seedOf(ttml: string): string {
  return `${occurrences(ttml, "<p ")}:${occurrences(ttml, '<span begin="')}`;
}

function maskOf(seed: string): number {
  return (fnv1a(seed) * COUNT_LIMIT + (fnv1a(`${seed}#`) % COUNT_LIMIT)) % TAG_SPACE;
}

function packCounts(tag: BuildTag): number {
  const counts = [tag.untouched, tag.heard, tag.fixed, tag.handSynced];
  const packed = counts.reduce(
    (total, count) => total * COUNT_LIMIT + Math.min(Math.max(0, Math.round(count)), COUNT_LIMIT - 1),
    0,
  );
  return packed * 2 + (tag.handEdited ? 1 : 0);
}

function unpackCounts(packed: number): BuildTag {
  let rest = Math.floor(packed / 2);
  const counts: number[] = [];
  for (let i = 0; i < 4; i++) {
    counts.unshift(rest % COUNT_LIMIT);
    rest = Math.floor(rest / COUNT_LIMIT);
  }
  const [untouched, heard, fixed, handSynced] = counts;
  return { untouched, heard, fixed, handSynced, handEdited: packed % 2 === 1 };
}

function checkOf(packed: number, seed: string): number {
  return fnv1a(`${packed}:${seed}`) % CHECK_LIMIT;
}

function encodeBuildTag(tag: BuildTag, seed: string): string {
  const packed = packCounts(tag);
  const value = (packed * CHECK_LIMIT + checkOf(packed, seed) + maskOf(seed)) % TAG_SPACE;
  return value.toString(36).padStart(TAG_LENGTH, "0");
}

function decodeBuildTag(value: string, seed: string): BuildTag | null {
  const raw = (Number.parseInt(value, 36) - maskOf(seed) + TAG_SPACE) % TAG_SPACE;
  const packed = Math.floor(raw / CHECK_LIMIT);
  return raw % CHECK_LIMIT === checkOf(packed, seed) ? unpackCounts(packed) : null;
}

function withBuildTag(ttml: string, tag: BuildTag): string {
  const untagged = ttml.replace(BUILD_ATTRIBUTE, "");
  const value = encodeBuildTag(tag, seedOf(untagged));
  return untagged.replace(ROOT_OPEN, (root) => `${root} composer:build="${value}"`);
}

function readBuildTag(ttml: string): BuildTag | null {
  const value = ttml.match(BUILD_ATTRIBUTE)?.[1];
  return value === undefined ? null : decodeBuildTag(value, seedOf(ttml));
}

// -- Exports ------------------------------------------------------------------

export { readBuildTag, withBuildTag };
export type { AlignmentCounts, BuildTag };
