import { staleGeneratedLanguages } from "@/domain/language/stale-generated";
import { useProjectStore } from "@/stores/project";
import { watchGenerationEdits } from "@/views/languages/generation-edit-guard";
import { mergeGeneratedLanguageUpdates } from "@/views/languages/merge-generated-language-updates";
import { requestLanguageGeneration } from "@/views/languages/request-language-generation";

// -- Interfaces ---------------------------------------------------------------

interface LanguageAutoRefreshOptions {
  delayMs: number;
}

interface LanguageAutoRefresh {
  schedule: () => void;
  refreshNow: () => Promise<void>;
  dispose: () => void;
}

// -- Constants ----------------------------------------------------------------

const LOG_PREFIX = "[LanguageAutoRefresh]";

// -- Refresh ------------------------------------------------------------------

async function refreshStaleGeneratedLanguages(signal: AbortSignal): Promise<void> {
  const starting = useProjectStore.getState();
  const groups = staleGeneratedLanguages(starting.lines);
  if (groups.length === 0) return;
  const startingById = new Map(starting.lines.map((line) => [line.id, line]));
  const requests = groups.map((group) => {
    const lines = group.lineIds.flatMap((id) => startingById.get(id) ?? []);
    return { group, lines, startingLines: new Map(lines.map((line) => [line.id, line])) };
  });
  const watchedLines = new Map(requests.flatMap(({ startingLines }) => [...startingLines]));
  const watchedLanguages = [...new Set(groups.flatMap((group) => group.translations))];
  const { edits, stop } = watchGenerationEdits(watchedLines, watchedLanguages, signal);
  try {
    const generations = await Promise.all(
      requests.map(({ group, lines }) =>
        requestLanguageGeneration(lines, {
          translations: group.translations,
          transliteration: group.transliteration,
          sourceLanguage: starting.metadata.language || "auto",
          signal,
        }),
      ),
    );
    const current = useProjectStore.getState();
    if (
      signal.aborted ||
      current.projectSession !== starting.projectSession ||
      current.metadata.language !== starting.metadata.language
    ) {
      return;
    }
    const updates = requests.flatMap(({ group, startingLines }, index) =>
      mergeGeneratedLanguageUpdates(
        startingLines,
        current.lines,
        group.translations,
        {
          force: false,
          transliteration: generations[index].transliteration,
          translations: generations[index].translations,
        },
        edits,
      ),
    );
    if (updates.length > 0) current.applyLineUpdatesToCurrentStep(updates);
  } finally {
    stop();
  }
}

// -- Scheduler ----------------------------------------------------------------

function createLanguageAutoRefresh({ delayMs }: LanguageAutoRefreshOptions): LanguageAutoRefresh {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | null = null;
  let queue: Promise<void> = Promise.resolve();

  const refreshNow = (): Promise<void> => {
    queue = queue.then(async () => {
      if (controller.signal.aborted) return;
      try {
        await refreshStaleGeneratedLanguages(controller.signal);
      } catch (error) {
        if ((error as Error).name !== "AbortError") console.warn(LOG_PREFIX, "refresh failed", error);
      }
    });
    return queue;
  };

  const schedule = (): void => {
    if (controller.signal.aborted) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      void refreshNow();
    }, delayMs);
  };

  const dispose = (): void => {
    controller.abort();
    if (timer) clearTimeout(timer);
    timer = null;
  };

  return { schedule, refreshNow, dispose };
}

// -- Exports ------------------------------------------------------------------

export { createLanguageAutoRefresh };
