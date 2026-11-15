import { drawnLine, drawnSyllables } from "insync/line-drawn-track";
import type { LyricLine } from "insync/line";
import type { SyllableAddress } from "insync/selection-model";
import { resolveAddresses } from "@/domain/selection/resolve";
import { getSplitCharacter } from "@/utils/split-character";

function buildCandidateLines(
  lines: readonly LyricLine[],
  addresses: ReadonlyArray<SyllableAddress>,
): LyricLine[] | undefined {
  if (addresses.length === 0) return undefined;
  const selectedWords = resolveAddresses(lines, addresses, getSplitCharacter());
  if (selectedWords.length !== addresses.length) return undefined;

  const byLine = new Map<string, { mainIdxs: Set<number>; bgIdxs: Set<number>; lineIndex: number }>();
  for (const sel of selectedWords) {
    let entry = byLine.get(sel.lineId);
    if (!entry) {
      entry = { mainIdxs: new Set(), bgIdxs: new Set(), lineIndex: sel.lineIndex };
      byLine.set(sel.lineId, entry);
    }
    if (sel.type === "word") entry.mainIdxs.add(sel.wordIndex);
    else entry.bgIdxs.add(sel.wordIndex);
  }

  const linesById = new Map<string, LyricLine>();
  for (const l of lines) linesById.set(l.id, l);

  const candidates: { line: LyricLine; lineIndex: number }[] = [];
  for (const [lineId, { mainIdxs, bgIdxs, lineIndex }] of byLine) {
    const line = linesById.get(lineId);
    if (!line) return undefined;
    const totalMain = drawnSyllables(line, "main", getSplitCharacter()).length;
    const totalBg = drawnSyllables(line, "bg", getSplitCharacter()).length;
    if (mainIdxs.size !== totalMain) return undefined;
    if (bgIdxs.size !== totalBg) return undefined;
    candidates.push({ line, lineIndex });
  }

  candidates.sort((a, b) => a.lineIndex - b.lineIndex);
  return candidates.map((c) => drawnLine(c.line, getSplitCharacter()));
}

export { buildCandidateLines };
