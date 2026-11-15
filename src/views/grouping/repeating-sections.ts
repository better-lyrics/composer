import { repeatKey, withEvenSyllableSplits } from "@/domain/group/syllable-splits";
import type { LyricLine } from "@/domain/line/model";
import { hasMainLyrics } from "@/domain/line/predicates";
import { backgroundText, lineText } from "@/domain/line/text";
import { backgroundTrack, mainTrack, timedSyllables } from "@/domain/line/track";

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

interface ScanInput {
  lines: LyricLine[];
  keyIds: Int32Array;
  samePositions: number[][];
  standaloneCandidate: Uint8Array;
}

interface RepeatCandidate {
  start: number;
  reach: number;
}

// Two-line repeats only fill lines the longer repeats left, so they never break up a chorus.
function findRepeatingStandaloneSections(lines: LyricLine[], splitChar: string): RepeatingSection[] {
  const scan = scanInput(lines, splitChar);
  const claimed = new Uint8Array(lines.length);
  const sections = claimSections(scan, claimed, splitChar, MIN_SECTION_LINES);
  for (const p of chantLoopLines(scan, SHORT_SECTION_LINES)) claimed[p] = 1;
  const shortSections = claimSections(scan, claimed, splitChar, SHORT_SECTION_LINES, SHORT_SECTION_LINES);
  return [...sections, ...shortSections].toSorted((a, b) => a.starts[0] - b.starts[0]);
}

function scanInput(lines: LyricLine[], splitChar: string): ScanInput {
  const idByKey = new Map<string, number>();
  const keyIds = new Int32Array(lines.length);
  const samePositions: number[][] = [];
  const standaloneCandidate = new Uint8Array(lines.length);
  for (let p = 0; p < lines.length; p++) {
    const key = repeatKey(lines[p], splitChar);
    let id = idByKey.get(key);
    if (id === undefined) {
      id = samePositions.length;
      idByKey.set(key, id);
      samePositions.push([]);
    }
    keyIds[p] = id;
    samePositions[id].push(p);
    if (lines[p].groupId === undefined && hasMainLyrics(lines[p])) standaloneCandidate[p] = 1;
  }
  return { lines, keyIds, samePositions, standaloneCandidate };
}

// runs[p] is how many standalone lines start at p, so a block of k lines at p is standalone when runs[p] >= k.
function standaloneRuns(scan: ScanInput, claimed: Uint8Array): Int32Array {
  const runs = new Int32Array(scan.lines.length + 1);
  for (let p = scan.lines.length - 1; p >= 0; p--) runs[p] = isStandaloneLine(scan, claimed, p) ? runs[p + 1] + 1 : 0;
  return runs;
}

function claimRuns(scan: ScanInput, claimed: Uint8Array, runs: Int32Array, start: number, length: number): void {
  for (let p = start; p < start + length; p++) claimed[p] = 1;
  for (let p = start + length - 1; p >= 0; p--) {
    const run = isStandaloneLine(scan, claimed, p) ? runs[p + 1] + 1 : 0;
    if (p < start && run === runs[p]) break;
    runs[p] = run;
  }
}

function isStandaloneLine(scan: ScanInput, claimed: Uint8Array, p: number): boolean {
  return scan.standaloneCandidate[p] === 1 && claimed[p] === 0;
}

// Later copies of the block at i, each with the longest block length it can still match.
function repeatCandidates(scan: ScanInput, runs: Int32Array, i: number, maxK: number, minK: number): RepeatCandidate[] {
  const { keyIds } = scan;
  const candidates: RepeatCandidate[] = [];
  for (const j of scan.samePositions[keyIds[i]]) {
    if (j < i + minK || runs[j] < minK) continue;
    const cap = Math.min(maxK, runs[j]);
    let matched = 0;
    while (matched < cap && keyIds[i + matched] === keyIds[j + matched]) matched++;
    if (matched >= minK) candidates.push({ start: j, reach: matched });
  }
  return candidates;
}

function repeatStarts(candidates: readonly RepeatCandidate[], start: number, k: number): number[] {
  const starts: number[] = [start];
  let next = start + k;
  for (const candidate of candidates) {
    if (candidate.start < next || candidate.reach < k) continue;
    starts.push(candidate.start);
    next = candidate.start + k;
  }
  return starts;
}

function claimSections(
  scan: ScanInput,
  claimed: Uint8Array,
  splitChar: string,
  minK: number,
  maxK = Number.POSITIVE_INFINITY,
): RepeatingSection[] {
  const { lines } = scan;
  const results: RepeatingSection[] = [];
  const runs = standaloneRuns(scan, claimed);

  for (let i = 0; i < lines.length; i++) {
    const topK = Math.min(maxK, Math.floor((lines.length - i) / 2), runs[i]);
    if (topK < minK) continue;
    const candidates = repeatCandidates(scan, runs, i, topK, minK);
    const reach = candidates.reduce((most, candidate) => Math.max(most, candidate.reach), 0);

    let best: { starts: number[]; k: number; evened: LyricLine[] } | null = null;
    for (let k = reach; k >= minK; k--) {
      const starts = repeatStarts(candidates, i, k);
      if (starts.length < 2 || (best && starts.length * k <= best.starts.length * best.k)) continue;
      const candidate = evenableStarts(lines, starts, k, splitChar);
      if (candidate && (!best || candidate.starts.length * k > best.starts.length * best.k)) best = { ...candidate, k };
    }

    if (best) {
      const { starts, k, evened } = best;
      for (const s of starts) claimRuns(scan, claimed, runs, s, k);
      results.push({
        starts,
        length: k,
        preview: lineText(lines[i]),
        previewLines: lines.slice(i, i + k).map((l) => lineText(l)),
        fingerprint: fingerprintBlock(lines, i, k),
        evenedSplitLines: changedLineCount(lines, evened, starts, k),
      });
      i = i + k - 1;
    }
  }

  return results;
}

// Lines of a short block sung again right after itself are a chant loop, not a repeated section.
function chantLoopLines(scan: ScanInput, k: number): number[] {
  const { lines, keyIds } = scan;
  const loopLines: number[] = [];
  for (let start = 0; start + 2 * k <= keyIds.length; start++) {
    if (!blocksRepeat(keyIds, start, start + k, k)) continue;
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

function blocksRepeat(keys: Int32Array, a: number, b: number, k: number): boolean {
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
    const wordsKey = timedSyllables(mainTrack(l))
      .map((w) => w.text + w.sep)
      .join(FS);
    const bgKey = timedSyllables(backgroundTrack(l))
      .map((w) => w.text + w.sep)
      .join(FS);
    parts.push([lineText(l), l.agentId, backgroundText(l) ?? "", wordsKey, bgKey].join(RS));
  }
  return parts.join("\n");
}

export type { RepeatingSection };
export { findRepeatingStandaloneSections };
