import { languageSourceFingerprint } from "@/domain/language/fingerprint";
import type { TranslationTrack, TransliterationTrack } from "@/domain/language/model";
import { alignPastedLanguageLines } from "@/domain/language/paste-import";
import { validateTransliterationAlignment } from "@/domain/language/transliteration-format";
import type { LyricLine } from "@/domain/line/model";
import { useProjectStore } from "@/stores/project";
import { Button } from "@/ui/button";
import { Modal } from "@/ui/modal";
import { IconAlertTriangle, IconArrowsRight, IconCheck, IconFileImport } from "@tabler/icons-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";

interface PasteImportModalProps {
  isOpen: boolean;
  initialText: string;
  lines: LyricLine[];
  sourceLanguage?: string;
  languageOptions: ReadonlyArray<readonly [string, string]>;
  defaultTargetLanguage: string;
  defaultKind: "transliteration" | "translation";
  onClose: () => void;
  onImportedTranslation: (language: string) => void;
}

const PasteImportModal: React.FC<PasteImportModalProps> = ({
  isOpen,
  initialText,
  lines,
  sourceLanguage,
  languageOptions,
  defaultTargetLanguage,
  defaultKind,
  onClose,
  onImportedTranslation,
}) => {
  const updateLinesWithHistory = useProjectStore((state) => state.updateLinesWithHistory);
  const [kind, setKind] = useState<"transliteration" | "translation">(defaultKind);
  const [targetLanguage, setTargetLanguage] = useState(defaultTargetLanguage);
  const [pastedText, setPastedText] = useState(initialText);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const alignment = useMemo(
    () =>
      alignPastedLanguageLines(
        pastedText,
        lines.map((line) => line.text),
      ),
    [lines, pastedText],
  );
  const [manualRows, setManualRows] = useState<string[] | null>(null);
  const mappedLines = manualRows ?? alignment.mappedLines;
  const errors = useMemo(
    () =>
      kind === "transliteration"
        ? lines.map((line, index) => validateTransliterationAlignment(line.text, mappedLines[index] ?? "", line.words))
        : lines.map(() => null),
    [kind, lines, mappedLines],
  );
  const errorCount = errors.filter(Boolean).length;
  const mappedCount = mappedLines.filter((line) => line.trim()).length;

  const updateMappedLine = (index: number, value: string) => {
    const next = mappedLines.slice();
    next[index] = value;
    setManualRows(next);
  };

  const importContent = () => {
    if (errorCount > 0 || mappedCount === 0) return;
    const updates: Array<{ id: string; updates: Partial<LyricLine> }> = [];
    lines.forEach((line, index) => {
      const text = mappedLines[index]?.trim();
      if (!text) return;
      const sourceFingerprint = languageSourceFingerprint(line.text, line.backgroundText);
      if (kind === "transliteration") {
        const transliteration: TransliterationTrack = {
          language: `${sourceLanguage || "und"}-Latn`,
          text,
          segments: [{ original: line.text, transliteration: text }],
          origin: "import",
          sourceFingerprint,
        };
        updates.push({ id: line.id, updates: { transliteration } });
        return;
      }
      const translations = {
        ...(line.translations ?? {}),
        [targetLanguage]: {
          language: targetLanguage,
          text,
          origin: "import",
          sourceFingerprint,
        } satisfies TranslationTrack,
      };
      updates.push({ id: line.id, updates: { translations } });
    });
    updateLinesWithHistory(updates, { deriveText: false, propagateToSiblings: false });
    if (kind === "translation") onImportedTranslation(targetLanguage);
    toast.success(`Imported ${mappedCount} ${kind} lines`);
    onClose();
  };

  const status =
    alignment.strategy === "preserve"
      ? "Blank lines preserved"
      : alignment.strategy === "compact"
        ? "Blank lines ignored"
        : "Manual alignment needed";

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Import language text"
      className="max-w-6xl max-h-[calc(100vh-2rem)]"
      bodyClassName="p-0"
      initialFocusRef={textareaRef}
    >
      <div className="grid h-[min(78vh,48rem)] min-h-0 overflow-y-auto lg:overflow-hidden lg:grid-cols-[minmax(20rem,0.8fr)_minmax(32rem,1.4fr)]">
        <div className="flex flex-col min-h-0 p-5 border-b lg:border-b-0 lg:border-r border-composer-border bg-composer-bg-elevated">
          <div className="flex p-1 mb-4 rounded-lg bg-composer-input">
            {(["transliteration", "translation"] as const).map((value) => (
              <button
                type="button"
                key={value}
                onClick={() => setKind(value)}
                className={`flex-1 h-8 px-3 text-sm capitalize rounded-md transition-colors ${kind === value ? "bg-composer-button-hover text-composer-text shadow-sm" : "text-composer-text-muted hover:text-composer-text"}`}
              >
                {value}
              </button>
            ))}
          </div>
          {kind === "translation" && (
            <label className="flex items-center justify-between gap-3 mb-3 text-sm text-composer-text-secondary">
              <span>Language</span>
              <select
                aria-label="Imported translation language"
                value={targetLanguage}
                onChange={(event) => setTargetLanguage(event.target.value)}
                className="h-8 px-2 border rounded-md bg-composer-input border-composer-border"
              >
                {languageOptions.map(([code, name]) => (
                  <option key={code} value={code}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="flex flex-col flex-1 min-h-52 gap-2 text-xs font-medium tracking-wide uppercase text-composer-text-muted">
            Pasted text
            <textarea
              ref={textareaRef}
              value={pastedText}
              onChange={(event) => {
                setPastedText(event.target.value);
                setManualRows(null);
              }}
              spellCheck={false}
              className="flex-1 min-h-52 p-3 font-mono text-sm leading-6 normal-case border resize-none rounded-lg bg-composer-input text-composer-text border-composer-border focus:outline-none focus:border-composer-accent"
            />
          </label>
          <p className="mt-3 text-xs leading-5 text-composer-text-muted">
            Composer first preserves blank rows. If that does not fit, it retries without blank rows.
          </p>
        </div>

        <div className="flex flex-col min-w-0 min-h-0 overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-composer-border">
            <div>
              <p className="text-sm font-medium">Line mapping</p>
              <p className="text-xs text-composer-text-muted">Review or edit each imported line before applying it.</p>
            </div>
            <span
              className={`inline-flex items-center gap-1.5 px-2 py-1 text-xs rounded-full ${alignment.strategy === "manual" ? "bg-amber-500/15 text-amber-300" : "bg-emerald-500/15 text-emerald-300"}`}
            >
              {alignment.strategy === "manual" ? (
                <IconAlertTriangle className="size-3.5" />
              ) : (
                <IconCheck className="size-3.5" />
              )}
              {status}
            </span>
          </div>
          {(alignment.warning || errorCount > 0) && (
            <div className="px-5 py-2 text-xs border-b bg-amber-500/10 border-amber-500/20 text-amber-200">
              {errorCount > 0
                ? `${errorCount} transliteration ${errorCount === 1 ? "line has" : "lines have"} word or syllable boundary mismatches.`
                : alignment.warning}
            </div>
          )}
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
            {lines.map((line, index) => (
              <div
                key={line.id}
                className="grid grid-cols-[2rem_minmax(0,1fr)_1.5rem_minmax(0,1fr)] items-start gap-2 px-5 py-2.5 border-b border-composer-border/70"
              >
                <span className="pt-2 font-mono text-xs text-composer-text-muted">{index + 1}</span>
                <p className="pt-1.5 text-sm leading-5 break-words text-composer-text-secondary">
                  {line.text || <span className="italic text-composer-text-muted">Blank line</span>}
                </p>
                <IconArrowsRight className="mt-2 size-4 text-composer-text-muted" />
                <div>
                  <input
                    aria-label={`Imported line ${index + 1}`}
                    value={mappedLines[index] ?? ""}
                    onChange={(event) => updateMappedLine(index, event.target.value)}
                    className={`w-full h-9 px-2.5 text-sm border rounded-md bg-composer-input focus:outline-none ${errors[index] ? "border-red-500 focus:border-red-400" : "border-composer-border focus:border-composer-accent"}`}
                  />
                  {errors[index] && <p className="mt-1 text-xs leading-4 text-red-400">{errors[index]}</p>}
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between gap-3 px-5 py-4 border-t border-composer-border bg-composer-bg-dark">
            <span className="text-xs text-composer-text-muted">
              {mappedCount} of {lines.length} lines ready
            </span>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button hasIcon variant="primary" disabled={errorCount > 0 || mappedCount === 0} onClick={importContent}>
                <IconFileImport className="size-4" />
                Import {kind}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export { PasteImportModal };
