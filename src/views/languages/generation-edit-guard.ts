import { ALIGN_TRANSLITERATION } from "@/domain/commands/languages";
import { lineTranslations } from "@/domain/language/line-languages";
import type { LyricLine } from "@/domain/line/model";
import { useProjectStore } from "@/stores/project";
import { sameTransliteration } from "@/views/languages/same-transliteration";

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
    // A re-saved alignment can leave the track as it was, but it is still the user's reading.
    const step = current.history === previous.history ? undefined : current.history[current.historyIndex];
    const realignedId = step?.note?.command === ALIGN_TRANSLITERATION ? step.note.args[0] : undefined;
    for (const id of startingLines.keys()) {
      const before = previousLines.get(id);
      const after = currentLines.get(id);
      if (id === realignedId || !sameTransliteration(before, after)) edits.transliteration.add(id);
      for (const language of targets) {
        if ((before && lineTranslations(before))?.[language] === (after && lineTranslations(after))?.[language])
          continue;
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
