import { linesOfInstance } from "@/domain/instance/enumerate";
import { instanceKey } from "@/domain/instance/key";
import { isLinked } from "@/domain/instance/predicates";
import type { LyricLine } from "@/domain/line/model";
import { backgroundText, lineText } from "@/domain/line/text";
import { backgroundTrack, mainTrack, timedSyllables } from "@/domain/line/track";

// -- Helpers -------------------------------------------------------------------

// Timing may cover only part of a line, so only the words both lines have timed must agree.
function timedWordsAgree(
  a: readonly { text: string; sep: string }[],
  b: readonly { text: string; sep: string }[],
): boolean {
  const shared = Math.min(a.length, b.length);
  for (let i = 0; i < shared; i++) if (a[i].text !== b[i].text || a[i].sep !== b[i].sep) return false;
  return true;
}

// -- Public --------------------------------------------------------------------

function linesStructurallyEqual(a: LyricLine, b: LyricLine): boolean {
  if (lineText(a) !== lineText(b)) return false;
  if (a.agentId !== b.agentId) return false;
  if ((backgroundText(a) ?? "") !== (backgroundText(b) ?? "")) return false;
  return (
    timedWordsAgree(timedSyllables(mainTrack(a)), timedSyllables(mainTrack(b))) &&
    timedWordsAgree(timedSyllables(backgroundTrack(a)), timedSyllables(backgroundTrack(b)))
  );
}

function structurallyEqualLineSequences(a: readonly LyricLine[], b: readonly LyricLine[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (!linesStructurallyEqual(a[i], b[i])) return false;
  }
  return true;
}

function findMatchingTemplate(
  candidate: readonly LyricLine[],
  lines: readonly LyricLine[],
): { groupId: string; instanceIdx: number } | null {
  const seen = new Set<string>();
  for (const line of lines) {
    if (!isLinked(line)) continue;
    const key = instanceKey(line.groupId, line.instanceIdx);
    if (seen.has(key)) continue;
    seen.add(key);
    const instanceLines = linesOfInstance(lines, line.groupId, line.instanceIdx).toSorted(
      (p, q) => (p.templateLineIdx ?? 0) - (q.templateLineIdx ?? 0),
    );
    if (structurallyEqualLineSequences(candidate, instanceLines)) {
      return { groupId: line.groupId, instanceIdx: line.instanceIdx };
    }
  }
  return null;
}

// -- Exports -------------------------------------------------------------------

export { linesStructurallyEqual, structurallyEqualLineSequences, findMatchingTemplate };
