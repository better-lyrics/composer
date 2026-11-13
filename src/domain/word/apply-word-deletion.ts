import { getLinkScope, isLinkedSibling, unlinkLines } from "@/domain/group/linking";
import { lineInstanceKey } from "@/domain/instance/key";
import { withManualBackgroundWords } from "@/domain/line/background";
import type { LyricLine } from "@/domain/line/model";
import { hasAnyTiming, isLineSynced } from "@/domain/line/predicates";
import { mainTrack, roleWords } from "@/domain/line/track";
import { withMainTrack, withoutTrackTiming, withTrackWords } from "@/domain/line/track-writes";
import { absorbDeletedSyllablesIntoNeighbors } from "@/domain/word/syllable-groups";

interface DeletionSelection {
  lineId: string;
  type: "word" | "bg";
  wordIndex: number;
}

// -- Helpers ------------------------------------------------------------------

function isLineFullyEmpty(line: LyricLine): boolean {
  return !hasAnyTiming(line);
}

function trackLength(line: LyricLine, type: "word" | "bg"): number {
  if (type === "bg") return roleWords(line, "bg")?.length ?? 0;
  return isLineSynced(line) ? 1 : (roleWords(line, "main")?.length ?? 0);
}

function deleteFromLines(lines: LyricLine[], selections: ReadonlyArray<DeletionSelection>): Map<string, LyricLine> {
  const byLine = new Map<string, { mainIdxs: Set<number>; bgIdxs: Set<number> }>();
  for (const sel of selections) {
    let entry = byLine.get(sel.lineId);
    if (!entry) {
      entry = { mainIdxs: new Set(), bgIdxs: new Set() };
      byLine.set(sel.lineId, entry);
    }
    if (sel.type === "word") entry.mainIdxs.add(sel.wordIndex);
    else entry.bgIdxs.add(sel.wordIndex);
  }

  const linesById = new Map<string, LyricLine>();
  for (const l of lines) linesById.set(l.id, l);

  const updatedById = new Map<string, LyricLine>();

  for (const [lineId, { mainIdxs, bgIdxs }] of byLine) {
    const line = linesById.get(lineId);
    if (!line) continue;

    const mainWords = roleWords(line, "main") ?? [];
    const main = mainTrack(line);
    let updatedLine = line;
    if (isLineSynced(line) && mainIdxs.has(0)) {
      updatedLine = withMainTrack(line, withoutTrackTiming(main));
    } else if (mainWords.length > 0 && mainIdxs.size > 0) {
      const absorbed = absorbDeletedSyllablesIntoNeighbors(mainWords, mainIdxs);
      const nextMain = absorbed.filter((_, i) => !mainIdxs.has(i));
      updatedLine = withMainTrack(
        line,
        nextMain.length > 0 ? withTrackWords(main, nextMain) : withoutTrackTiming(main),
      );
    }

    const bgWords = roleWords(line, "bg") ?? [];
    if (bgWords.length > 0 && bgIdxs.size > 0) {
      const absorbed = absorbDeletedSyllablesIntoNeighbors(bgWords, bgIdxs);
      const remaining = absorbed.filter((_, i) => !bgIdxs.has(i));
      updatedLine = withManualBackgroundWords(updatedLine, remaining);
    }

    updatedById.set(lineId, updatedLine);
  }

  return updatedById;
}

function emptiedInstanceKeys(lines: LyricLine[], updatedById: Map<string, LyricLine>): Set<string> {
  const touched = new Set<string>();
  for (const updated of updatedById.values()) {
    const key = lineInstanceKey(updated);
    if (key) touched.add(key);
  }

  const emptied = new Set(touched);
  for (const line of lines) {
    const key = lineInstanceKey(line);
    if (key && emptied.has(key) && !isLineFullyEmpty(updatedById.get(line.id) ?? line)) emptied.delete(key);
  }
  return emptied;
}

// A partial delete is a structure edit, so it reaches every linked instance; emptying a whole instance clears only that one.
function withLinkedSiblings(
  lines: LyricLine[],
  selections: ReadonlyArray<DeletionSelection>,
  emptied: Set<string>,
): DeletionSelection[] {
  const linesById = new Map<string, LyricLine>();
  for (const l of lines) linesById.set(l.id, l);

  const expanded = [...selections];
  for (const sel of selections) {
    const line = linesById.get(sel.lineId);
    const scope = line ? getLinkScope(line) : null;
    if (!line || !scope || emptied.has(lineInstanceKey(line) ?? "")) continue;
    for (const sibling of lines) {
      if (sibling.id === line.id || !isLinkedSibling(sibling, scope)) continue;
      if (emptied.has(lineInstanceKey(sibling) ?? "")) continue;
      if (trackLength(sibling, sel.type) !== trackLength(line, sel.type)) continue;
      expanded.push({ lineId: sibling.id, type: sel.type, wordIndex: sel.wordIndex });
    }
  }
  return expanded;
}

// -- Deletion -----------------------------------------------------------------

function applyWordDeletion(lines: LyricLine[], selectedWords: ReadonlyArray<DeletionSelection>): LyricLine[] {
  if (selectedWords.length === 0) return lines;

  const emptied = emptiedInstanceKeys(lines, deleteFromLines(lines, selectedWords));
  const selections = withLinkedSiblings(lines, selectedWords, emptied);
  const updatedById = deleteFromLines(lines, selections);

  const result = lines.map((line) => updatedById.get(line.id) ?? line);
  if (emptied.size === 0) return result;

  // An emptied instance becomes standalone placeholder rows, so paste-as-instance can refill it without an orphan banner.
  return unlinkLines(result, (line) => emptied.has(lineInstanceKey(line) ?? ""));
}

export type { DeletionSelection };
export { applyWordDeletion };
