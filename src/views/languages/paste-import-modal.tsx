import { alignTrackToLine, validateTransliterationAlignment } from "@/domain/language/align";
import { languageSourceFingerprint } from "@/domain/language/fingerprint";
import type { TranslationTrack, TransliterationTrack } from "@/domain/language/model";
import { alignPastedLanguageLines } from "@/domain/language/paste-import";
import type { LyricLine } from "@/domain/line/model";
import { useProjectStore } from "@/stores/project";
import { Button } from "@/ui/button";
import { INPUT_STYLES } from "@/ui/input-styles";
import { Modal } from "@/ui/modal";
import { SegmentedControl } from "@/ui/segmented-control";
import { Select } from "@/ui/select";
import { StatusChip } from "@/ui/status-chip";
import { cn } from "@/utils/cn";
import { IconAlertTriangle, IconArrowRight, IconCheck, IconFileImport } from "@tabler/icons-react";
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

// -- Constants ----------------------------------------------------------------

const KIND_OPTIONS = [
  { value: "transliteration", label: "Transliteration" },
  { value: "translation", label: "Translation" },
] as const;

const STRATEGY_LABEL = {
  preserve: "Blank lines kept",
  compact: "Blank lines dropped",
  manual: "Match lines by hand",
} as const;

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
  const languageSelectOptions = languageOptions.map(([value, label]) => ({ value, label }));

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
        updates.push({ id: line.id, updates: alignTrackToLine(line, transliteration) });
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
    toast.success(`Imported ${mappedCount} ${mappedCount === 1 ? "line" : "lines"}`);
    onClose();
  };

  const status = STRATEGY_LABEL[alignment.strategy];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Import pasted lines"
      className="max-w-6xl max-h-[calc(100vh-2rem)]"
      bodyClassName="p-0"
      initialFocusRef={textareaRef}
    >
      <div className="grid h-[min(78vh,48rem)] min-h-0 overflow-y-auto lg:overflow-hidden lg:grid-cols-[minmax(20rem,0.8fr)_minmax(32rem,1.4fr)]">
        <div className="flex min-h-0 flex-col gap-4 p-5 border-b lg:border-b-0 lg:border-r border-composer-border">
          <div className="flex items-center justify-between gap-3">
            <SegmentedControl aria-label="Import as" value={kind} options={KIND_OPTIONS} onChange={setKind} />
            {kind === "translation" && (
              <Select
                aria-label="Imported translation language"
                value={targetLanguage}
                onChange={setTargetLanguage}
                options={languageSelectOptions}
                className="h-8"
              />
            )}
          </div>
          <label className="flex flex-1 min-h-52 flex-col gap-1.5">
            <span className="text-xs font-medium text-composer-text-secondary select-none">Pasted text</span>
            <textarea
              ref={textareaRef}
              value={pastedText}
              onChange={(event) => {
                setPastedText(event.target.value);
                setManualRows(null);
              }}
              spellCheck={false}
              className={cn(INPUT_STYLES, "flex-1 min-h-52 p-3 font-mono leading-6 resize-none")}
            />
          </label>
          <p className="text-xs text-composer-text-muted text-pretty select-none">
            Blank lines are kept if the counts match. If not, they get dropped.
          </p>
        </div>

        <div className="flex min-w-0 min-h-0 flex-col overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-composer-border select-none">
            <p className="text-sm font-medium">Line mapping</p>
            <StatusChip
              tone={alignment.strategy === "manual" ? "warning" : "positive"}
              icon={alignment.strategy === "manual" ? IconAlertTriangle : IconCheck}
              className="h-6 text-xs"
            >
              {status}
            </StatusChip>
          </div>
          {(alignment.warning || errorCount > 0) && (
            <div className="px-5 py-2 text-xs border-b border-composer-warning/20 bg-composer-warning/10 text-composer-warning select-text">
              {errorCount > 0
                ? `${errorCount} ${errorCount === 1 ? "line doesn't" : "lines don't"} fit the timing yet.`
                : alignment.warning}
            </div>
          )}
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
            {lines.map((line, index) => (
              <div
                key={line.id}
                className="grid grid-cols-[2rem_minmax(0,1fr)_1.25rem_minmax(0,1fr)] items-start gap-2 px-5 py-2 border-b border-composer-border"
              >
                <span className="pt-2 font-mono text-xs text-composer-text-muted tabular-nums select-none">
                  {index + 1}
                </span>
                <p className="pt-1.5 text-sm leading-5 break-words text-composer-text-secondary select-text">
                  {line.text || <span className="italic text-composer-text-muted">Blank line</span>}
                </p>
                <IconArrowRight aria-hidden="true" className="mt-2.5 size-3.5 text-composer-text-faint" />
                <div>
                  <input
                    aria-label={`Imported line ${index + 1}`}
                    aria-invalid={Boolean(errors[index])}
                    value={mappedLines[index] ?? ""}
                    onChange={(event) => updateMappedLine(index, event.target.value)}
                    className={cn(
                      INPUT_STYLES,
                      "w-full",
                      errors[index] && "border-composer-error focus:border-composer-error",
                    )}
                  />
                  {errors[index] && (
                    <p className="mt-1 text-xs text-composer-error-text select-text cursor-text">{errors[index]}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between gap-3 px-5 py-4 border-t border-composer-border select-none">
            <span className="text-xs text-composer-text-muted tabular-nums">
              {mappedCount} of {lines.length} lines ready
            </span>
            <div className="flex gap-2">
              <Button onClick={onClose}>Cancel</Button>
              <Button hasIcon variant="primary" disabled={errorCount > 0 || mappedCount === 0} onClick={importContent}>
                <IconFileImport className="size-4" />
                Import {mappedCount} {mappedCount === 1 ? "line" : "lines"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export { PasteImportModal };
