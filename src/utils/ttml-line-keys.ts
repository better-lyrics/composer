import type { LyricLine } from "@/domain/line/model";
import { isLineTimed } from "@/domain/line/sync-progress";

// -- Types --------------------------------------------------------------------

interface KeyedLine {
  line: LyricLine;
  key: string;
}

// -- Constants ----------------------------------------------------------------

const PARAGRAPH_OPENING_TAG = /<p\b[^>]*>/g;
const LINE_KEY_ATTRIBUTE = /\s+itunes:key="([^"]*)"/;
const TEXT_REFERENCE = /<text for="([^"]*)">/g;
const ALTERNATE_CONTAINER = /(<(translation|transliteration)\b[^>]*>)([\s\S]*?)(\s*<\/\2>)/g;
const CANONICAL_TEXT_ITEM = /(\s*)<text for="#(\d+)">[\s\S]*?<\/text>/g;

// -- Helpers ------------------------------------------------------------------

function sortedTextItems(items: string): string {
  const matches = [...items.matchAll(CANONICAL_TEXT_ITEM)];
  if (items.replace(CANONICAL_TEXT_ITEM, "") !== "") return items;
  return matches
    .toSorted((a, b) => Number(a[2]) - Number(b[2]))
    .map((match) => match[0])
    .join("");
}

// -- Functions ----------------------------------------------------------------

function keyedExportLines(lines: readonly LyricLine[]): KeyedLine[] {
  return lines.filter(isLineTimed).map((line, index) => ({ line, key: `L${index + 1}` }));
}

function canonicalLineKeys(ttml: string): string {
  const ordinalByKey = new Map<string, number>();
  let ordinal = 0;
  const withoutKeys = ttml.replace(PARAGRAPH_OPENING_TAG, (tag) => {
    ordinal++;
    const key = tag.match(LINE_KEY_ATTRIBUTE)?.[1];
    if (key !== undefined && !ordinalByKey.has(key)) ordinalByKey.set(key, ordinal);
    return tag.replace(LINE_KEY_ATTRIBUTE, "");
  });
  const referenced = withoutKeys.replace(TEXT_REFERENCE, (tag, key: string) => {
    const paragraph = ordinalByKey.get(key);
    return paragraph === undefined ? tag : `<text for="#${paragraph}">`;
  });
  return referenced.replace(
    ALTERNATE_CONTAINER,
    (_block, open: string, _name: string, items: string, close: string) => `${open}${sortedTextItems(items)}${close}`,
  );
}

// -- Exports ------------------------------------------------------------------

export { canonicalLineKeys, keyedExportLines };
