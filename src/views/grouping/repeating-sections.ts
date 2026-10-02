import type { LyricLine } from "@/domain/line/model";
import { hasMainLyrics } from "@/domain/line/predicates";
import { structurallyEqualLineSequences } from "@/views/timeline/structural-match";

interface RepeatingSection {
  starts: number[];
  length: number;
  preview: string;
  previewLines: string[];
  fingerprint: string;
}

function findRepeatingStandaloneSections(lines: LyricLine[]): RepeatingSection[] {
  const results: RepeatingSection[] = [];
  const claimed = new Set<number>();

  for (let i = 0; i < lines.length; i++) {
    if (claimed.has(i)) continue;
    if (lines[i].groupId !== undefined) continue;

    let best: { starts: number[]; k: number } | null = null;
    const maxK = Math.floor((lines.length - i) / 2);
    for (let k = maxK; k >= 2; k--) {
      if (!isStandaloneBlock(lines, i, k, claimed)) continue;
      const starts = repeatStarts(lines, i, k, claimed);
      if (starts.length >= 2 && (!best || starts.length * k > best.starts.length * best.k)) best = { starts, k };
    }

    if (best) {
      const { starts, k } = best;
      for (const s of starts) {
        for (let p = s; p < s + k; p++) claimed.add(p);
      }
      results.push({
        starts,
        length: k,
        preview: lines[i].text,
        previewLines: lines.slice(i, i + k).map((l) => l.text),
        fingerprint: fingerprintBlock(lines, i, k),
      });
      i = i + k - 1;
    }
  }

  return results;
}

function repeatStarts(lines: LyricLine[], start: number, k: number, claimed: Set<number>): number[] {
  const block = lines.slice(start, start + k);
  const starts: number[] = [start];
  let j = start + k;
  while (j + k <= lines.length) {
    if (isStandaloneBlock(lines, j, k, claimed) && structurallyEqualLineSequences(block, lines.slice(j, j + k))) {
      starts.push(j);
      j += k;
    } else {
      j++;
    }
  }
  return starts;
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
