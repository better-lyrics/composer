import { pastedRows } from "@/domain/language/paste-import";
import { googleLanguageProvider } from "@/services/google-language-provider";
import { useProjectStore } from "@/stores/project";
import { Button } from "@/ui/button";
import { EmptyState } from "@/ui/empty-state";
import { Scroll } from "@/ui/scroll";
import { watchGenerationEdits } from "@/views/languages/generation-edit-guard";
import { languageGenerationInputs } from "@/views/languages/generation-inputs";
import { LANGUAGE_OPTIONS, SOURCE_LANGUAGE_OPTIONS } from "@/views/languages/language-options";
import { LanguageLineEditor } from "@/views/languages/line-editor";
import { mergeGeneratedLanguageUpdates } from "@/views/languages/merge-generated-language-updates";
import { PasteImportModal } from "@/views/languages/paste-import-modal";
import { RegenerateLanguageControl } from "@/views/languages/regenerate-language-control";
import { LanguageStatusSummaries } from "@/views/languages/status-summaries";
import { TransliterationHelp } from "@/views/languages/transliteration-help";
import { useLanguageTargets } from "@/views/languages/use-language-targets";
import { IconLanguage, IconX } from "@tabler/icons-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
const LanguagesPanel: React.FC = () => {
  const lines = useProjectStore((state) => state.lines);
  const metadata = useProjectStore((state) => state.metadata);
  const projectSession = useProjectStore((state) => state.projectSession);
  const activeTab = useProjectStore((state) => state.activeTab);
  const updateLinesWithHistory = useProjectStore((state) => state.updateLinesWithHistory);
  const setMetadata = useProjectStore((state) => state.setMetadata);
  const { targets, targetsRef, setTargets, project } = useLanguageTargets(lines, metadata, projectSession);
  const [nextTarget, setNextTarget] = useState("es");
  const [isGenerating, setIsGenerating] = useState(false);
  const [pasteImport, setPasteImport] = useState<{
    text: string;
    kind: "transliteration" | "translation";
    language: string;
  } | null>(null);
  const generatedOnEntry = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const sourceLanguage = metadata.language || "auto";
  const generate = useCallback(
    async (
      requestedTargets: string[],
      force = false,
      requestedSource = sourceLanguage,
      includeTransliteration = true,
    ) => {
      const startingState = useProjectStore.getState();
      if (startingState.lines.length === 0 || abortRef.current) return;
      const startingLines = new Map(startingState.lines.map((line) => [line.id, line]));
      const controller = new AbortController();
      abortRef.current = controller;
      const { edits, stop } = watchGenerationEdits(startingLines, requestedTargets, controller.signal);
      setIsGenerating(true);
      try {
        const { mainInputs, bgInputs } = languageGenerationInputs(startingState.lines);
        const [romanizationResults, translationResults] = await Promise.all([
          includeTransliteration
            ? Promise.all([
                googleLanguageProvider.transliterate(mainInputs, requestedSource, controller.signal),
                googleLanguageProvider.transliterate(bgInputs, requestedSource, controller.signal),
              ])
            : Promise.resolve(null),
          Promise.all(
            requestedTargets.flatMap((language) => [
              googleLanguageProvider.translate(mainInputs, language, requestedSource, controller.signal),
              googleLanguageProvider.translate(bgInputs, language, requestedSource, controller.signal),
            ]),
          ),
        ]);
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
        if (
          [...(romanizationResults ?? []), ...translationResults].some((batch) =>
            batch.lines.some((result) => result.failed),
          )
        ) {
          toast.error("Some language content could not be generated");
        }
        const romanMain = romanizationResults?.[0];
        const romanBg = romanizationResults?.[1];
        const transliterationGeneration = romanMain
          ? {
              language: romanMain.language,
              backgroundLanguage: romanBg?.language,
              main: new Map(romanMain.lines.map((result) => [result.id, result])),
              background: new Map(romanBg?.lines.map((result) => [result.id, result]) ?? []),
            }
          : undefined;
        const translationPairs = requestedTargets.map((language, index) => ({
          language,
          main: new Map(translationResults[index * 2].lines.map((result) => [result.id, result])),
          background: new Map(translationResults[index * 2 + 1].lines.map((result) => [result.id, result])),
        }));
        const updates = mergeGeneratedLanguageUpdates(
          startingLines,
          currentState.lines,
          targetsRef.current,
          { force, transliteration: transliterationGeneration, translations: translationPairs },
          edits,
        );
        if (updates.length > 0) updateLinesWithHistory(updates, { deriveText: false, propagateToSiblings: false });
        const detected = romanMain?.detectedLanguage || translationResults[0]?.detectedLanguage;
        if (updates.length > 0 && !currentState.metadata.language && detected && detected !== "auto") {
          setMetadata({ language: detected });
        }
      } catch (error) {
        if ((error as Error).name !== "AbortError") toast.error("Some language content could not be generated");
      } finally {
        stop();
        if (abortRef.current === controller) {
          abortRef.current = null;
          setIsGenerating(false);
        }
      }
    },
    [setMetadata, sourceLanguage, targetsRef, updateLinesWithHistory],
  );
  // Activity tears down effects on hide, even without a render of the new tab.
  // biome-ignore lint/correctness/useExhaustiveDependencies: Tab and project changes must cancel the previous generation lifecycle.
  useEffect(
    () => () => {
      generatedOnEntry.current = false;
      abortRef.current?.abort();
      abortRef.current = null;
      setIsGenerating(false);
    },
    [activeTab, project],
  );
  useEffect(() => {
    if (activeTab !== "languages" || generatedOnEntry.current || lines.length === 0) return;
    generatedOnEntry.current = true;
    void generate(targets);
  }, [activeTab, generate, lines.length, targets]);
  const languageName = useMemo(() => new Map<string, string>(LANGUAGE_OPTIONS), []);
  const availableLanguages = LANGUAGE_OPTIONS.filter(([code]) => !targets.includes(code));
  useEffect(() => {
    if (!targets.includes(nextTarget)) return;
    const next = LANGUAGE_OPTIONS.find(([code]) => !targets.includes(code));
    if (next) setNextTarget(next[0]);
  }, [nextTarget, targets]);
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
  const changeSourceLanguage = (language: string) => {
    const selected = language || "auto";
    setMetadata({ language: language || undefined });
    let requestedTargets = targets;
    if (selected !== "en" && !targets.includes("en")) {
      requestedTargets = [...targets, "en"];
      setTargets(requestedTargets);
    }
    void generate(requestedTargets, false, selected);
  };

  if (lines.length === 0) {
    return <EmptyState message="No lyrics to translate" hint="Add lyrics in the Edit tab first" />;
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
          language: field?.dataset.languageImportLanguage || nextTarget,
        });
      }}
    >
      <div className="flex items-center justify-between px-6 py-4 border-b border-composer-border">
        <div>
          <h2 className="text-lg font-medium">Languages</h2>
          <p className="text-sm text-composer-text-muted">
            Google-generated content stays editable and never adds another timing track.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            aria-label="Translation language"
            value={nextTarget}
            disabled={availableLanguages.length === 0}
            onChange={(event) => setNextTarget(event.target.value)}
            className="h-9 px-2 text-sm border rounded-md bg-composer-input border-composer-border"
          >
            {availableLanguages.map(([code, name]) => (
              <option value={code} key={code}>
                {name}
              </option>
            ))}
          </select>
          <Button
            disabled={isGenerating || availableLanguages.length === 0 || targets.includes(nextTarget)}
            onClick={() => {
              if (targets.includes(nextTarget)) return;
              const next = [...targets, nextTarget];
              setTargets(next);
              void generate([nextTarget]);
            }}
          >
            Add translation
          </Button>
          <RegenerateLanguageControl
            isGenerating={isGenerating}
            translations={targets}
            languageNames={languageName}
            onRegenerateAll={() => void generate(targets, true)}
            onRegenerateSelection={(selection) =>
              void generate(selection.translations, true, sourceLanguage, selection.transliteration)
            }
          />
        </div>
      </div>

      <div className="flex items-center gap-2 px-6 py-2 border-b border-composer-border">
        <IconLanguage className="size-4 text-composer-text-muted" />
        <label className="flex items-center gap-2 text-sm text-composer-text-secondary">
          <span>Source</span>
          <select
            aria-label="Source language"
            value={metadata.language ?? ""}
            disabled={isGenerating}
            onChange={(event) => changeSourceLanguage(event.target.value)}
            className="h-8 px-2 text-sm border rounded-md bg-composer-input border-composer-border"
          >
            {SOURCE_LANGUAGE_OPTIONS.map(([code, name]) => (
              <option value={code} key={code || "auto"}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <TransliterationHelp />
        {targets.map((language) => (
          <span key={language} className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-composer-button">
            {languageName.get(language) ?? language}
            <button type="button" aria-label={`Remove ${language}`} onClick={() => removeTarget(language)}>
              <IconX className="size-3" />
            </button>
          </span>
        ))}
      </div>

      <Scroll className="flex-1">
        <div className="flex flex-col gap-3 p-6">
          <LanguageStatusSummaries lines={lines} languageNames={languageName} />
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

export { LanguagesPanel };
