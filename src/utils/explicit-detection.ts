import type { LinkGroup } from "@/domain/group/template";
import type { LyricLine } from "@/domain/line/model";
import { getSplitCharacter } from "@/utils/split-character";
import { splitIntoWordsWithMeta } from "@/utils/sync-helpers";
import { englishDataset, englishRecommendedTransformers, RegExpMatcher } from "obscenity";

// -- Types ---------------------------------------------------------------------

interface LinkedInstance {
  lineId: string;
  lineIndex: number;
  instanceIdx: number;
}

interface LinkedInfo {
  groupId: string;
  groupLabel: string;
  instanceCount: number;
  instances: LinkedInstance[];
}

interface ExplicitSuggestion {
  lineId: string;
  lineIndex: number;
  field: "words" | "backgroundWords";
  wordIndices: number[];
  word: string;
  fingerprint: string;
  linked?: LinkedInfo;
}

interface FieldHit {
  wordIndices: number[];
  word: string;
}

interface RawHit extends FieldHit {
  line: LyricLine;
  lineIndex: number;
  field: "words" | "backgroundWords";
}

interface FieldScans {
  splitChar: string;
  hitsBySource: Map<string, FieldHit[]>;
}

// -- Matcher (singleton) -------------------------------------------------------

let cachedMatcher: RegExpMatcher | null = null;

function getMatcher(): RegExpMatcher {
  if (cachedMatcher) return cachedMatcher;
  cachedMatcher = new RegExpMatcher({
    ...englishDataset.build(),
    ...englishRecommendedTransformers,
  });
  return cachedMatcher;
}

// -- Word-range mapping --------------------------------------------------------

interface WordRange {
  start: number;
  end: number;
  text: string;
  syllableIndices: number[];
}

function buildWordRanges(text: string): { canonical: string; ranges: WordRange[] } {
  const { parts, trailingSpace } = splitIntoWordsWithMeta(text);
  if (parts.length === 0) return { canonical: "", ranges: [] };

  const ranges: WordRange[] = [];
  const pieces: string[] = [];
  let offset = 0;
  let syllableBuffer: number[] = [];
  let textBuffer = "";

  for (let i = 0; i < parts.length; i++) {
    syllableBuffer.push(i);
    textBuffer += parts[i];
    const finishesWord = trailingSpace[i] || i === parts.length - 1;
    if (!finishesWord) continue;

    const start = offset;
    const end = start + textBuffer.length;
    pieces.push(textBuffer);
    ranges.push({ start, end, text: textBuffer, syllableIndices: syllableBuffer });

    if (i < parts.length - 1) {
      pieces.push(" ");
      offset = end + 1;
    } else {
      offset = end;
    }
    syllableBuffer = [];
    textBuffer = "";
  }

  return { canonical: pieces.join(""), ranges };
}

function rangeForOffset(ranges: WordRange[], startIndex: number): WordRange | null {
  for (const r of ranges) {
    if (startIndex >= r.start && startIndex < r.end) return r;
  }
  return null;
}

// -- Fingerprint ---------------------------------------------------------------

function normalizeWordKey(word: string): string {
  return word.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function standaloneFingerprint(
  lineId: string,
  field: "words" | "backgroundWords",
  wordIndex: number,
  word: string,
): string {
  return `${lineId}:${field}:${wordIndex}:${normalizeWordKey(word)}`;
}

function linkedFingerprint(
  groupId: string,
  templateLineIdx: number,
  field: "words" | "backgroundWords",
  wordIndex: number,
  word: string,
): string {
  return `group:${groupId}:${templateLineIdx}:${field}:${wordIndex}:${normalizeWordKey(word)}`;
}

// -- Detection -----------------------------------------------------------------

function scanField(source: string, alreadyMarked: Set<number>): FieldHit[] {
  const { canonical, ranges } = buildWordRanges(source);
  if (canonical.length === 0) return [];
  const matches = getMatcher().getAllMatches(canonical, true);
  const seenStart = new Set<number>();
  const hits: FieldHit[] = [];
  for (const m of matches) {
    const range = rangeForOffset(ranges, m.startIndex);
    if (!range) continue;
    if (seenStart.has(range.start)) continue;
    const allMarked = range.syllableIndices.every((idx) => alreadyMarked.has(idx));
    if (allMarked) continue;
    seenStart.add(range.start);
    hits.push({ wordIndices: range.syllableIndices, word: range.text });
  }
  return hits;
}

// Replaced on every run, so it only ever holds the fields of the current lyrics.
let lastFieldScans: FieldScans = { splitChar: "", hitsBySource: new Map() };

function fieldHits(source: string, words: LyricLine["words"], scans: FieldScans, previous: FieldScans): FieldHit[] {
  const marked = alreadyMarkedSet(words);
  const key = `${[...marked].join(",")}\u0000${source}`;
  const hits = scans.hitsBySource.get(key) ?? previous.hitsBySource.get(key) ?? scanField(source, marked);
  scans.hitsBySource.set(key, hits);
  return hits;
}

function alreadyMarkedSet(words: LyricLine["words"] | undefined): Set<number> {
  const set = new Set<number>();
  if (!words) return set;
  for (let i = 0; i < words.length; i++) {
    if (words[i].explicit === true) set.add(i);
  }
  return set;
}

function isLinked(line: LyricLine): boolean {
  return line.groupId !== undefined && line.templateLineIdx !== undefined && !line.detached;
}

function findExplicitWords(lines: LyricLine[], groups: LinkGroup[] = []): ExplicitSuggestion[] {
  const scans: FieldScans = { splitChar: getSplitCharacter(), hitsBySource: new Map() };
  const previous = lastFieldScans.splitChar === scans.splitChar ? lastFieldScans : scans;
  const raw: RawHit[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.text && line.text.trim().length > 0) {
      for (const hit of fieldHits(line.text, line.words, scans, previous)) {
        raw.push({ ...hit, line, lineIndex: i, field: "words" });
      }
    }
    if (line.backgroundText && line.backgroundText.trim().length > 0) {
      for (const hit of fieldHits(line.backgroundText, line.backgroundWords, scans, previous)) {
        raw.push({ ...hit, line, lineIndex: i, field: "backgroundWords" });
      }
    }
  }
  lastFieldScans = scans;

  const groupLabelById = new Map(groups.map((g) => [g.id, g.label]));
  const linkedBuckets = new Map<string, RawHit[]>();
  const standaloneHits: RawHit[] = [];

  for (const hit of raw) {
    if (!isLinked(hit.line)) {
      standaloneHits.push(hit);
      continue;
    }
    const key = linkedFingerprint(
      hit.line.groupId as string,
      hit.line.templateLineIdx as number,
      hit.field,
      hit.wordIndices[0],
      hit.word,
    );
    const bucket = linkedBuckets.get(key);
    if (bucket) bucket.push(hit);
    else linkedBuckets.set(key, [hit]);
  }

  const out: ExplicitSuggestion[] = [];

  for (const [fingerprint, hits] of linkedBuckets) {
    if (hits.length === 1) {
      const hit = hits[0];
      out.push({
        lineId: hit.line.id,
        lineIndex: hit.lineIndex,
        field: hit.field,
        wordIndices: hit.wordIndices,
        word: hit.word,
        fingerprint: standaloneFingerprint(hit.line.id, hit.field, hit.wordIndices[0], hit.word),
      });
      continue;
    }

    const sorted = hits.toSorted((a, b) => (a.line.instanceIdx ?? 0) - (b.line.instanceIdx ?? 0));
    const representative = sorted[0];
    out.push({
      lineId: representative.line.id,
      lineIndex: representative.lineIndex,
      field: representative.field,
      wordIndices: representative.wordIndices,
      word: representative.word,
      fingerprint,
      linked: {
        groupId: representative.line.groupId as string,
        groupLabel: groupLabelById.get(representative.line.groupId as string) ?? "Group",
        instanceCount: sorted.length,
        instances: sorted.map((h) => ({
          lineId: h.line.id,
          lineIndex: h.lineIndex,
          instanceIdx: h.line.instanceIdx ?? 0,
        })),
      },
    });
  }

  for (const hit of standaloneHits) {
    out.push({
      lineId: hit.line.id,
      lineIndex: hit.lineIndex,
      field: hit.field,
      wordIndices: hit.wordIndices,
      word: hit.word,
      fingerprint: standaloneFingerprint(hit.line.id, hit.field, hit.wordIndices[0], hit.word),
    });
  }

  return out;
}

// -- Exports -------------------------------------------------------------------

export { findExplicitWords };
export type { ExplicitSuggestion };
