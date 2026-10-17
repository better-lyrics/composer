import type { LyricLine } from "@/domain/line/model";
import { hasMainLyrics } from "@/domain/line/predicates";
import { isLineTimed } from "@/domain/line/sync-progress";

// -- Types --------------------------------------------------------------------

interface KeyedLine {
  line: LyricLine;
  key: string;
}

type LineKeyIds = Readonly<Record<string, string>>;

// -- Constants ----------------------------------------------------------------

const PARAGRAPH_OPENING_TAG = /<p\b[^>]*>/g;
const LINE_KEY_ATTRIBUTE = /(\s+)itunes:key=(["'])(.*?)\2/;
const TEXT_REFERENCE = /<text for=(["'])(.*?)\1>/g;
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

function isExportedLine(line: LyricLine): boolean {
  return isLineTimed(line) && (hasMainLyrics(line) || !!line.backgroundText?.trim());
}

function keyedExportLines(lines: readonly LyricLine[]): KeyedLine[] {
  return lines.filter(isExportedLine).map((line, index) => ({ line, key: `L${index + 1}` }));
}

function canonicalLineKeys(ttml: string): string {
  const ordinalByKey = new Map<string, number>();
  let ordinal = 0;
  const withoutKeys = ttml.replace(PARAGRAPH_OPENING_TAG, (tag) => {
    ordinal++;
    const key = tag.match(LINE_KEY_ATTRIBUTE)?.[3];
    if (key !== undefined && !ordinalByKey.has(key)) ordinalByKey.set(key, ordinal);
    return tag.replace(LINE_KEY_ATTRIBUTE, "");
  });
  const referenced = withoutKeys.replace(TEXT_REFERENCE, (tag, _quote: string, key: string) => {
    const paragraph = ordinalByKey.get(key);
    return paragraph === undefined ? tag : `<text for="#${paragraph}">`;
  });
  return referenced.replace(
    ALTERNATE_CONTAINER,
    (_block, open: string, _name: string, items: string, close: string) => `${open}${sortedTextItems(items)}${close}`,
  );
}

function lineKeyIds(lines: readonly LyricLine[]): LineKeyIds {
  return Object.fromEntries(keyedExportLines(lines).map(({ line, key }) => [key, line.id]));
}

function renumberLineKeys(ttml: string, from: LineKeyIds, to: LineKeyIds): string {
  const keyById = new Map(Object.entries(to).map(([key, id]) => [id, key] as const));
  const renamed = new Map<string, string>();
  let freshKeys = 0;
  const target = (key: string): string => {
    const known = renamed.get(key);
    if (known !== undefined) return known;
    const id = from[key];
    const next = (id === undefined ? undefined : keyById.get(id)) ?? `N${++freshKeys}`;
    renamed.set(key, next);
    return next;
  };
  return ttml
    .replace(PARAGRAPH_OPENING_TAG, (tag) =>
      tag.replace(
        LINE_KEY_ATTRIBUTE,
        (_attribute, space: string, quote: string, key: string) => `${space}itunes:key=${quote}${target(key)}${quote}`,
      ),
    )
    .replace(TEXT_REFERENCE, (_tag, quote: string, key: string) => `<text for=${quote}${target(key)}${quote}>`);
}

// -- Exports ------------------------------------------------------------------

export { canonicalLineKeys, isExportedLine, keyedExportLines, lineKeyIds, renumberLineKeys };
export type { LineKeyIds };
