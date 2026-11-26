import { sameTime } from "@/domain/group/same-timing";
import { instanceKey } from "@/domain/instance/key";
import { isLinked } from "@/domain/instance/predicates";
import { mainBounds } from "@/domain/line/bounds";
import type { LyricLine } from "@/domain/line/model";
import { isLineSynced, isWordSynced } from "@/domain/line/predicates";
import { mainTrack, roleWords } from "@/domain/line/track";
import type { WordTiming } from "@/domain/word/timing";

// -- Types --------------------------------------------------------------------

interface ReplacedInstance {
  groupId: string;
  instanceIdx: number;
}

// -- Functions ----------------------------------------------------------------

function keepsTimedWords(before: readonly WordTiming[] = [], after: readonly WordTiming[] = []): boolean {
  return before.every((word, index) => {
    const next = after[index];
    return next !== undefined && sameTime(word.begin, next.begin) && sameTime(word.end, next.end);
  });
}

function keepsTimedMain(before: LyricLine, after: LyricLine): boolean {
  if (isWordSynced(before)) return keepsTimedWords(roleWords(before, "main"), roleWords(after, "main"));
  if (!isLineSynced(before)) return true;
  const bounds = mainBounds(after);
  return !!bounds && sameTime(mainTrack(before).begin, bounds.begin) && sameTime(mainTrack(before).end, bounds.end);
}

// An instance is replaced only when timing it already had changes; filling its untimed slots is sync progress.
function replacedInstances(before: readonly LyricLine[], after: readonly LyricLine[]): ReplacedInstance[] {
  const afterById = new Map(after.map((line) => [line.id, line]));
  const replaced = new Map<string, ReplacedInstance>();
  for (const line of before) {
    const next = afterById.get(line.id);
    if (!next || next === line || !isLinked(next)) continue;
    if (keepsTimedMain(line, next) && keepsTimedWords(roleWords(line, "bg"), roleWords(next, "bg"))) continue;
    replaced.set(instanceKey(next.groupId, next.instanceIdx), { groupId: next.groupId, instanceIdx: next.instanceIdx });
  }
  return [...replaced.values()];
}

// -- Exports ------------------------------------------------------------------

export { replacedInstances };
