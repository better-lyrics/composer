import type { LyricLine } from "@/domain/line/model";
import { useProjectStore } from "@/stores/project";

interface GenerationEdits {
  transliteration: Set<string>;
  translations: Map<string, Set<string>>;
}

function watchGenerationEdits(
  startingLines: ReadonlyMap<string, LyricLine>,
  targets: readonly string[],
  signal: AbortSignal,
) {
  const edits: GenerationEdits = { transliteration: new Set(), translations: new Map() };
  const unsubscribe = useProjectStore.subscribe((current, previous) => {
    if (current.lines === previous.lines) return;
    const previousLines = new Map(previous.lines.map((line) => [line.id, line]));
    const currentLines = new Map(current.lines.map((line) => [line.id, line]));
    for (const id of startingLines.keys()) {
      const before = previousLines.get(id);
      const after = currentLines.get(id);
      if (before?.transliteration !== after?.transliteration) edits.transliteration.add(id);
      for (const language of targets) {
        if (before?.translations?.[language] === after?.translations?.[language]) continue;
        const languages = edits.translations.get(id) ?? new Set<string>();
        languages.add(language);
        edits.translations.set(id, languages);
      }
    }
  });
  const stop = () => {
    unsubscribe();
    signal.removeEventListener("abort", stop);
  };
  signal.addEventListener("abort", stop, { once: true });
  return { edits, stop };
}

export { watchGenerationEdits };
export type { GenerationEdits };
