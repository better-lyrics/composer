import { languageSourceFingerprint } from "@/domain/language/fingerprint";
import type { TransliterationTrack } from "@/domain/language/model";
import { getLanguageReviewItems } from "@/domain/language/review";
import type { LyricLine } from "@/domain/line/model";
import { googleLanguageProvider } from "@/services/google-language-provider";
import { useProjectStore } from "@/stores/project";
import { Button } from "@/ui/button";
import { EmptyState } from "@/ui/empty-state";
import { Scroll } from "@/ui/scroll";
import { LANGUAGE_OPTIONS, SOURCE_LANGUAGE_OPTIONS } from "@/views/languages/language-options";
import { LanguageLineEditor } from "@/views/languages/line-editor";
import { PasteImportModal } from "@/views/languages/paste-import-modal";
import { LanguageReviewSummary } from "@/views/languages/review-summary";
import { TransliterationHelp } from "@/views/languages/transliteration-help";
import { IconLanguage, IconRefresh, IconX } from "@tabler/icons-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

const LanguagesPanel: React.FC = () => {
  const lines = useProjectStore((state) => state.lines);
  const metadata = useProjectStore((state) => state.metadata);
  const activeTab = useProjectStore((state) => state.activeTab);
  const updateLinesWithHistory = useProjectStore((state) => state.updateLinesWithHistory);
  const setMetadata = useProjectStore((state) => state.setMetadata);
  const [targets, setTargets] = useState<string[]>(() => {
    const found = new Set(lines.flatMap((line) => Object.keys(line.translations ?? {})));
    if (metadata.language !== "en") found.add("en");
    return [...found];
  });
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
    async (requestedTargets: string[], force = false, requestedSource = sourceLanguage) => {
      if (lines.length === 0 || isGenerating) return;
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setIsGenerating(true);
      try {
        const mainInputs: Array<{ id: string; text: string }> = [];
        const bgInputs: Array<{ id: string; text: string }> = [];
        for (const line of lines) {
          const text = line.text.trim();
          const backgroundText = line.backgroundText?.trim();
          if (text) mainInputs.push({ id: line.id, text });
          if (backgroundText) bgInputs.push({ id: line.id, text: backgroundText });
        }
        const [romanMain, romanBg, ...translationResults] = await Promise.all([
          googleLanguageProvider.transliterate(mainInputs, requestedSource, controller.signal),
          googleLanguageProvider.transliterate(bgInputs, requestedSource, controller.signal),
          ...requestedTargets.flatMap((language) => [
            googleLanguageProvider.translate(mainInputs, language, controller.signal),
            googleLanguageProvider.translate(bgInputs, language, controller.signal),
          ]),
        ]);
        const romanMainById = new Map(romanMain.lines.map((result) => [result.id, result]));
        const romanBgById = new Map(romanBg.lines.map((result) => [result.id, result]));
        const translationPairs = requestedTargets.map((language, index) => ({
          language,
          main: new Map(translationResults[index * 2].lines.map((result) => [result.id, result.text])),
          bg: new Map(translationResults[index * 2 + 1].lines.map((result) => [result.id, result.text])),
        }));
        const updates: Array<{ id: string; updates: Partial<LyricLine> }> = [];
        for (const line of lines) {
          const fingerprint = languageSourceFingerprint(line.text, line.backgroundText);
          const currentRoman = line.transliteration;
          const mayReplaceRoman = force || !currentRoman || currentRoman.origin === "google";
          const romanResult = romanMainById.get(line.id);
          const bgResult = romanBgById.get(line.id);
          let transliteration: TransliterationTrack | undefined = currentRoman;
          if (mayReplaceRoman && romanResult?.text) {
            transliteration = {
              language: romanMain.language,
              text: romanResult.text,
              backgroundText: bgResult?.text ?? undefined,
              segments: romanResult.segments,
              backgroundSegments: bgResult?.segments,
              origin: "google",
              sourceFingerprint: fingerprint,
            };
          } else if (mayReplaceRoman && currentRoman?.origin === "google") {
            transliteration = undefined;
          } else if (currentRoman && currentRoman.sourceFingerprint !== fingerprint) {
            transliteration = { ...currentRoman, stale: true };
          } else if (currentRoman?.stale) {
            const { stale: _stale, ...freshRoman } = currentRoman;
            transliteration = freshRoman;
          }
          const translations = { ...(line.translations ?? {}) };
          for (const pair of translationPairs) {
            const current = translations[pair.language];
            const mayReplace = force || !current || current.origin === "google";
            const text = pair.main.get(line.id);
            if (mayReplace && text) {
              translations[pair.language] = {
                language: pair.language,
                text,
                backgroundText: pair.bg.get(line.id) ?? undefined,
                origin: "google",
                sourceFingerprint: fingerprint,
              };
            } else if (current && current.sourceFingerprint !== fingerprint) {
              translations[pair.language] = { ...current, stale: true };
            } else if (current?.stale) {
              const { stale: _stale, ...freshTranslation } = current;
              translations[pair.language] = freshTranslation;
            }
          }
          updates.push({ id: line.id, updates: { transliteration, translations } });
        }
        updateLinesWithHistory(updates, { deriveText: false, propagateToSiblings: false });
        const detected = romanMain.detectedLanguage || translationResults[0]?.detectedLanguage;
        if (!metadata.language && detected && detected !== "auto") setMetadata({ language: detected });
      } catch (error) {
        if ((error as Error).name !== "AbortError") toast.error("Some language content could not be generated");
      } finally {
        if (abortRef.current === controller) setIsGenerating(false);
      }
    },
    [isGenerating, lines, metadata.language, setMetadata, sourceLanguage, updateLinesWithHistory],
  );

  useEffect(() => {
    if (activeTab !== "languages") {
      generatedOnEntry.current = false;
      abortRef.current?.abort();
      return;
    }
    if (generatedOnEntry.current || lines.length === 0) return;
    generatedOnEntry.current = true;
    void generate(targets);
  }, [activeTab, generate, lines.length, targets]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const languageName = useMemo(() => new Map<string, string>(LANGUAGE_OPTIONS), []);
  const availableLanguages = LANGUAGE_OPTIONS.filter(([code]) => !targets.includes(code));
  const reviewItems = getLanguageReviewItems(lines);

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
    if (updates.length > 0) {
      updateLinesWithHistory(updates, { deriveText: false, propagateToSiblings: false });
    }
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
        if (text.replace(/\r\n?/g, "\n").split("\n").length <= 3) return;
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
          <Button hasIcon variant="primary" disabled={isGenerating} onClick={() => void generate(targets, true)}>
            <IconRefresh className={`size-4 ${isGenerating ? "animate-spin" : ""}`} />
            {isGenerating ? "Generating…" : "Regenerate"}
          </Button>
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
          <LanguageReviewSummary items={reviewItems} languageNames={languageName} />
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
