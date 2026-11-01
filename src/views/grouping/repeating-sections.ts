import { repeatKey, withEvenSyllableSplits } from "@/domain/group/syllable-splits";
import type { LyricLine } from "@/domain/line/model";
import { hasMainLyrics } from "@/domain/line/predicates";

interface RepeatingSection {
  starts: number[];
  length: number;
  preview: string;
  previewLines: string[];
  fingerprint: string;
  evenedSplitLines: number;
}

const MIN_SECTION_LINES = 3;
const SHORT_SECTION_LINES = 2;

// Two-line repeats only fill lines the longer repeats left, so they never break up a chorus.
function findRepeatingStandaloneSections(lines: LyricLine[], splitChar: string): RepeatingSection[] {
  const keys = lines.map((line) => repeatKey(line, splitChar));
  const claimed = new Set<number>();
  const sections = claimSections(lines, keys, claimed, splitChar, MIN_SECTION_LINES);
  for (const p of chantLoopLines(lines, keys, SHORT_SECTION_LINES)) claimed.add(p);
  const shortSections = claimSections(lines, keys, claimed, splitChar, SHORT_SECTION_LINES, SHORT_SECTION_LINES);
  return [...sections, ...shortSections].toSorted((a, b) => a.starts[0] - b.starts[0]);
}

function claimSections(
  lines: LyricLine[],
  keys: string[],
  claimed: Set<number>,
  splitChar: string,
  minK: number,
  maxK = Number.POSITIVE_INFINITY,
): RepeatingSection[] {
  const results: RepeatingSection[] = [];

  for (let i = 0; i < lines.length; i++) {
    if (claimed.has(i)) continue;
    if (lines[i].groupId !== undefined) continue;

    let best: { starts: number[]; k: number; evened: LyricLine[] } | null = null;
    for (let k = Math.min(maxK, Math.floor((lines.length - i) / 2)); k >= minK; k--) {
      if (!isStandaloneBlock(lines, i, k, claimed)) continue;
      const starts = repeatStarts(lines, keys, i, k, claimed);
      if (starts.length < 2 || (best && starts.length * k <= best.starts.length * best.k)) continue;
      const candidate = evenableStarts(lines, starts, k, splitChar);
      if (candidate && (!best || candidate.starts.length * k > best.starts.length * best.k)) best = { ...candidate, k };
    }

    if (best) {
      const { starts, k, evened } = best;
      for (const s of starts) {
        for (let p = s; p < s + k; p++) claimed.add(p);
      }
      results.push({
        starts,
        length: k,
        preview: lines[i].text,
        previewLines: lines.slice(i, i + k).map((l) => l.text),
        fingerprint: fingerprintBlock(lines, i, k),
        evenedSplitLines: changedLineCount(lines, evened, starts, k),
      });
      i = i + k - 1;
    }
  }

  return results;
}

// Lines of a short block sung again right after itself are a chant loop, not a repeated section.
function chantLoopLines(lines: LyricLine[], keys: string[], k: number): number[] {
  const loopLines: number[] = [];
  for (let start = 0; start + 2 * k <= keys.length; start++) {
    if (!blocksRepeat(keys, start, start + k, k)) continue;
    if (!lines.slice(start, start + 2 * k).every(hasMainLyrics)) continue;
    for (let p = start; p < start + 2 * k; p++) loopLines.push(p);
  }
  return loopLines;
}

// A copy whose splits cross the others' is left out, so it cannot hide the copies that agree.
function evenableStarts(
  lines: LyricLine[],
  starts: number[],
  k: number,
  splitChar: string,
): { starts: number[]; evened: LyricLine[] } | null {
  const evened = withEvenSyllableSplits(lines, starts, k, splitChar);
  if (evened) return { starts, evened };
  const kept = [starts[0]];
  let keptEvened: LyricLine[] | null = null;
  for (const start of starts.slice(1)) {
    const withStart = withEvenSyllableSplits(lines, [...kept, start], k, splitChar);
    if (!withStart) continue;
    kept.push(start);
    keptEvened = withStart;
  }
  return keptEvened ? { starts: kept, evened: keptEvened } : null;
}

function repeatStarts(lines: LyricLine[], keys: string[], start: number, k: number, claimed: Set<number>): number[] {
  const starts: number[] = [start];
  let j = start + k;
  while (j + k <= lines.length) {
    if (blocksRepeat(keys, start, j, k) && isStandaloneBlock(lines, j, k, claimed)) {
      starts.push(j);
      j += k;
    } else {
      j++;
    }
  }
  return starts;
}

function blocksRepeat(keys: string[], a: number, b: number, k: number): boolean {
  for (let p = 0; p < k; p++) {
    if (keys[a + p] !== keys[b + p]) return false;
  }
  return true;
}

function changedLineCount(lines: LyricLine[], evened: LyricLine[], starts: number[], k: number): number {
  return starts.reduce((count, start) => {
    for (let p = start; p < start + k; p++) if (evened[p] !== lines[p]) count++;
    return count;
  }, 0);
}

function fingerprintBlock(lines: LyricLine[], start: number, length: number): string {
  const FS = "";
  const RS = "";
  const parts: string[] = [];
  for (let p = start; p < start + length; p++) {
    const l = lines[p];
    const wordsKey = (l.words ?? []).map((w) => w.text).join(FS);
    const bgKey = (l.backgroundWords ?? []).map((w) => w.text).join(FS);
    parts.push([l.text, l.agentId, l.backgroundText ?? "", wordsKey, bgKey].join(RS));
  }
  return parts.join("\n");
}

function isStandaloneBlock(lines: LyricLine[], start: number, length: number, claimed: Set<number>): boolean {
  if (start + length > lines.length) return false;
  for (let p = start; p < start + length; p++) {
    if (claimed.has(p)) return false;
    if (lines[p].groupId !== undefined) return false;
    if (!hasMainLyrics(lines[p])) return false;
  }
  return true;
}

export { findRepeatingStandaloneSections };
export type { RepeatingSection };
