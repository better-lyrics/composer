import type { LyricLine } from "@/domain/line/model";
import { roleWords } from "@/domain/line/track";
import { useProjectStore } from "@/stores/project";

// -- Helpers ------------------------------------------------------------------

function trackIdProblem(line: LyricLine): string | null {
  for (const words of [roleWords(line, "main"), roleWords(line, "bg")]) {
    const seen = new Set<string>();
    for (const word of words ?? []) {
      if (!word.id) return `line ${line.id}: word "${word.text}" has no id`;
      if (seen.has(word.id)) return `line ${line.id}: id ${word.id} twice in one track`;
      seen.add(word.id);
    }
  }
  return null;
}

// -- Invariant ----------------------------------------------------------------

useProjectStore.subscribe((state, previous) => {
  if (state.lines === previous.lines) return;
  const unchanged = new Set(previous.lines);
  for (const line of state.lines) {
    const problem = unchanged.has(line) ? null : trackIdProblem(line);
    if (problem) throw new Error(`[word ids] ${problem}`);
  }
});
