import { languageSourceFingerprint } from "@/domain/language/fingerprint";
import { staleGeneratedLanguages } from "@/domain/language/stale-generated";
import type { LyricLine } from "@/domain/line/model";
import { useProjectStore } from "@/stores/project";
import { isTransientLines } from "@/stores/project/transient-lines";
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

interface FailedSources {
  projectSession: number;
  sourceKeys: Set<string>;
}

// -- Constants ----------------------------------------------------------------

const LOG_PREFIX = "[LanguageAutoRefresh]";

// -- Refresh ------------------------------------------------------------------

function sourceKey(line: LyricLine): string {
  return `${line.id}\u0000${languageSourceFingerprint(line.text, line.backgroundText)}`;
}

// A drag preview is never refreshed: the write would end the gesture, and the drag's own commit schedules the next refresh.
async function refreshStaleGeneratedLanguages(signal: AbortSignal, failures: FailedSources): Promise<void> {
  const starting = useProjectStore.getState();
  if (isTransientLines(starting.lines)) return;
  if (failures.projectSession !== starting.projectSession) {
    failures.projectSession = starting.projectSession;
    failures.sourceKeys.clear();
  }
  const failedSources = failures.sourceKeys;
  const groups = staleGeneratedLanguages(starting.lines.filter((line) => !failedSources.has(sourceKey(line))));
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
    for (const generation of generations) {
      for (const id of generation.failedLineIds) {
        const line = startingById.get(id);
        if (line) failedSources.add(sourceKey(line));
      }
    }
    const current = useProjectStore.getState();
    if (
      signal.aborted ||
      isTransientLines(current.lines) ||
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
  const failures: FailedSources = { projectSession: useProjectStore.getState().projectSession, sourceKeys: new Set() };
  const retryFailed = () => failures.sourceKeys.clear();
  window.addEventListener("online", retryFailed);

  const refreshNow = (): Promise<void> => {
    queue = queue.then(async () => {
      if (controller.signal.aborted) return;
      try {
        await refreshStaleGeneratedLanguages(controller.signal, failures);
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
    window.removeEventListener("online", retryFailed);
    if (timer) clearTimeout(timer);
    timer = null;
  };

  return { schedule, refreshNow, dispose };
}

// -- Exports ------------------------------------------------------------------

export { createLanguageAutoRefresh };
