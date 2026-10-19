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
  const stale = staleGeneratedLanguages(starting.lines);
  if (!stale) return;
  const staleIds = new Set(stale.lineIds);
  const requestedLines = starting.lines.filter((line) => staleIds.has(line.id));
  const startingLines = new Map(requestedLines.map((line) => [line.id, line]));
  const { edits, stop } = watchGenerationEdits(startingLines, stale.translations, signal);
  try {
    const generation = await requestLanguageGeneration(requestedLines, {
      translations: stale.translations,
      transliteration: stale.transliteration,
      sourceLanguage: starting.metadata.language || "auto",
      signal,
    });
    const current = useProjectStore.getState();
    if (
      signal.aborted ||
      current.projectSession !== starting.projectSession ||
      current.metadata.language !== starting.metadata.language
    ) {
      return;
    }
    const updates = mergeGeneratedLanguageUpdates(
      startingLines,
      current.lines,
      stale.translations,
      { force: false, transliteration: generation.transliteration, translations: generation.translations },
      edits,
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
