import { pastedRows } from "@/domain/language/paste-import";
import { useLanguagesHistoryShortcuts } from "@/hooks/useLanguagesHistoryShortcuts";
import { useProjectStore } from "@/stores/project";
import { Button } from "@/ui/button";
import { EmptyState } from "@/ui/empty-state";
import { Scroll } from "@/ui/scroll";
import { Select } from "@/ui/select";
import { watchGenerationEdits } from "@/views/languages/generation-edit-guard";
import { LANGUAGE_OPTIONS, SOURCE_LANGUAGE_OPTIONS } from "@/views/languages/language-options";
import { LanguageTrackBar } from "@/views/languages/language-track-bar";
import { LanguageLineEditor } from "@/views/languages/line-editor";
import { mergeGeneratedLanguageUpdates } from "@/views/languages/merge-generated-language-updates";
import { PasteImportModal } from "@/views/languages/paste-import-modal";
import { RegenerateLanguageControl } from "@/views/languages/regenerate-language-control";
import { requestLanguageGeneration } from "@/views/languages/request-language-generation";
import { LanguageStatusSummaries } from "@/views/languages/status-summaries";
import { useLanguageTargets } from "@/views/languages/use-language-targets";
import { pluralWord, pluralize } from "@/utils/pluralize";
import { IconChevronDown } from "@tabler/icons-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

// -- Interfaces ---------------------------------------------------------------

interface GenerationOptions {
  force?: boolean;
  source?: string;
  transliteration?: boolean;
}

// -- Constants ----------------------------------------------------------------

const LOG_PREFIX = "[Languages]";

const SOURCE_SELECT_OPTIONS = SOURCE_LANGUAGE_OPTIONS.map(([value, label]) => ({ value, label }));

// -- Component ----------------------------------------------------------------

const LanguagesPanel: React.FC = () => {
  const lines = useProjectStore((state) => state.lines);
  const metadata = useProjectStore((state) => state.metadata);
  const projectSession = useProjectStore((state) => state.projectSession);
  const activeTab = useProjectStore((state) => state.activeTab);
  const updateLinesWithHistory = useProjectStore((state) => state.updateLinesWithHistory);
  const setMetadata = useProjectStore((state) => state.setMetadata);
  const { targets, targetsRef, setTargets, project } = useLanguageTargets(lines, projectSession);
  const [isGenerating, setIsGenerating] = useState(false);
  const [pasteImport, setPasteImport] = useState<{
    text: string;
    kind: "transliteration" | "translation";
    language: string;
  } | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const sourceLanguage = metadata.language || "auto";
  const generate = useCallback(
    async (requestedTargets: string[], options: GenerationOptions = {}) => {
      const {
        force = false,
        source: requestedSource = sourceLanguage,
        transliteration: includeTransliteration = true,
      } = options;
      const startingState = useProjectStore.getState();
      if (startingState.lines.length === 0 || abortRef.current) return;
      const startingLines = new Map(startingState.lines.map((line) => [line.id, line]));
      const controller = new AbortController();
      abortRef.current = controller;
      const { edits, stop } = watchGenerationEdits(startingLines, requestedTargets, controller.signal);
      setIsGenerating(true);
      try {
        const generation = await requestLanguageGeneration(startingState.lines, {
          translations: requestedTargets,
          transliteration: includeTransliteration,
          sourceLanguage: requestedSource,
          signal: controller.signal,
        });
        const currentState = useProjectStore.getState();
        if (
          controller.signal.aborted ||
          abortRef.current !== controller ||
          currentState.activeTab !== "languages" ||
          currentState.metadata.language !== startingState.metadata.language ||
          currentState.projectSession !== startingState.projectSession
        ) {
          return;
        }
        if (generation.failedLineIds.size > 0) toast.error("Couldn't generate some lines. Try Regenerate.");
        const updates = mergeGeneratedLanguageUpdates(
          startingLines,
          currentState.lines,
          targetsRef.current,
          { force, transliteration: generation.transliteration, translations: generation.translations },
          edits,
        );
        if (updates.length > 0) updateLinesWithHistory(updates, { deriveText: false, propagateToSiblings: false });
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
        console.warn(LOG_PREFIX, "generation failed", error);
        toast.error("Couldn't generate some lines. Try Regenerate.");
      } finally {
        stop();
        if (abortRef.current === controller) {
          abortRef.current = null;
          setIsGenerating(false);
        }
      }
    },
    [sourceLanguage, targetsRef, updateLinesWithHistory],
  );
  // Activity tears down effects on hide, even without a render of the new tab.
  // biome-ignore lint/correctness/useExhaustiveDependencies: Tab and project changes must cancel the previous generation lifecycle.
  useEffect(
    () => () => {
      abortRef.current?.abort();
      abortRef.current = null;
      setIsGenerating(false);
    },
    [activeTab, project],
  );
  useLanguagesHistoryShortcuts(activeTab === "languages");
  const languageName = useMemo(() => new Map<string, string>(LANGUAGE_OPTIONS), []);
  const availableLanguages = LANGUAGE_OPTIONS.filter(([code]) => !targets.includes(code));
  const removeTarget = (language: string) => {
    const updates = lines.flatMap((line) => {
      if (!line.translations?.[language]) return [];
      const translations = { ...line.translations };
      delete translations[language];
      return [{ id: line.id, updates: { translations } }];
    });
    if (updates.length > 0) updateLinesWithHistory(updates, { deriveText: false, propagateToSiblings: false });
    setTargets((all) => all.filter((item) => item !== language));
  };
  const addTarget = (language: string) => {
    if (targets.includes(language)) return;
    setTargets([...targets, language]);
    void generate([language], { transliteration: false });
  };
  const trackCount = targets.length + 1;
  const sourceLanguageLabel =
    SOURCE_SELECT_OPTIONS.find((option) => option.value === (metadata.language ?? ""))?.label ?? metadata.language;
  const changeSourceLanguage = (language: string) => {
    const selected = language || "auto";
    setMetadata({ language: language || undefined });
    const transliteration = lines.some((line) => line.transliteration?.origin === "google");
    if (targets.length > 0 || transliteration) void generate(targets, { source: selected, transliteration });
  };

  if (lines.length === 0) {
    return <EmptyState message="No lyrics to translate" hint="Add some in the Edit tab first." />;
  }

  return (
    <div
      className="flex flex-col flex-1 overflow-hidden"
      data-tour="languages-panel"
      onPasteCapture={(event) => {
        const text = event.clipboardData.getData("text/plain");
        if (pastedRows(text).length <= 3) return;
        event.preventDefault();
        const field = (event.target as HTMLElement).closest<HTMLElement>("[data-language-import-kind]");
        const kind = field?.dataset.languageImportKind === "translation" ? "translation" : "transliteration";
        setPasteImport({
          text,
          kind,
          language: field?.dataset.languageImportLanguage || targets[0] || LANGUAGE_OPTIONS[0][0],
        });
      }}
    >
      <div className="flex items-center justify-between gap-4 h-13 shrink-0 pl-5 pr-2 border-b border-(--divider) select-none">
        <div className="flex items-center gap-3 min-w-0">
          <h2 className="sr-only">Languages</h2>
          <span className="shrink-0 text-[13px] text-(--muted) tabular-nums">
            <b className="font-mono text-[15px] font-bold text-composer-text">{lines.length}</b>{" "}
            {pluralWord(lines.length, "line", "lines")} ・ {pluralize(trackCount, "track")}
          </span>
          <LanguageTrackBar
            targets={targets}
            languageNames={languageName}
            availableLanguages={availableLanguages}
            disabled={isGenerating}
            onAdd={addTarget}
            onRemove={removeTarget}
          />
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className="text-[13px] text-(--muted)">Source</span>
          <Select
            aria-label="Source language"
            value={metadata.language ?? ""}
            disabled={isGenerating}
            onChange={changeSourceLanguage}
            options={SOURCE_SELECT_OPTIONS}
            trigger={
              <Button
                size="lg"
                hasIcon
                aria-label="Source language"
                className="pr-[5px] aria-expanded:bg-(--layer-3) aria-expanded:text-composer-text"
              >
                {sourceLanguageLabel}
                <IconChevronDown className="size-3.5 opacity-50 transition-[rotate,opacity] in-aria-expanded:rotate-180 in-aria-expanded:opacity-90" />
              </Button>
            }
          />
          <RegenerateLanguageControl
            isGenerating={isGenerating}
            translations={targets}
            languageNames={languageName}
            onRegenerateAll={() => void generate(targets, { force: true })}
            onRegenerateSelection={(selection) =>
              void generate(selection.translations, { force: true, transliteration: selection.transliteration })
            }
          />
        </div>
      </div>

      <Scroll className="flex-1">
        <LanguageStatusSummaries lines={lines} languageNames={languageName} />
        <div>
          {lines.map((line, index) => (
            <LanguageLineEditor
              key={line.id}
              line={line}
              index={index}
              targets={targets}
              languageNames={languageName}
              sourceLanguage={metadata.language}
            />
          ))}
        </div>
      </Scroll>
      {pasteImport !== null && (
        <PasteImportModal
          isOpen
          initialText={pasteImport.text}
          lines={lines}
          sourceLanguage={metadata.language}
          languageOptions={LANGUAGE_OPTIONS}
          defaultTargetLanguage={pasteImport.language}
          defaultKind={pasteImport.kind}
          onClose={() => setPasteImport(null)}
          onImportedTranslation={(language) => {
            setTargets((all) => (all.includes(language) ? all : [...all, language]));
          }}
        />
      )}
    </div>
  );
};

// -- Exports ------------------------------------------------------------------

export { LanguagesPanel };
