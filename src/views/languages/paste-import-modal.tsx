import { IconAlertTriangle, IconArrowRight, IconCheck, IconFileImport } from "@tabler/icons-react";
import { useId, useMemo, useRef, useState } from "react";
import { alignTrackToLine, validateTransliterationAlignment } from "@/domain/language/align";
import { languageSourceFingerprint } from "@/domain/language/fingerprint";
import { wholeLineSegments } from "@/domain/language/manual-segments";
import type { TranslationTrack, TransliterationTrack } from "@/domain/language/model";
import { alignPastedLanguageLines } from "@/domain/language/paste-import";
import type { LyricLine } from "@/domain/line/model";
import { noteGuideSignal } from "@/lib/guide-signals";
import { type PasteTranslationsDraft, clearModalDraft, readModalDraft, writeModalDraft } from "@/lib/modal-drafts";
import { useProjectStore } from "@/stores/project";
import { Button } from "@/ui/button";
import { FieldError } from "@/ui/field-error";
import { INPUT_STYLES } from "@/ui/input-styles";
import { Modal } from "@/ui/modal";
import { SegmentedControl } from "@/ui/segmented-control";
import { Select } from "@/ui/select";
import { StatusChip } from "@/ui/status-chip";
import { cn } from "@/utils/cn";
import { pluralize } from "@/utils/pluralize";
import { toast } from "@/utils/toast";

// -- Interfaces ---------------------------------------------------------------

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

type PasteKind = PasteTranslationsDraft["kind"];

const KIND_OPTIONS = [
  { value: "transliteration", label: "Transliteration" },
  { value: "translation", label: "Translation" },
] as const;

const STRATEGY_LABEL = {
  preserve: "Blank lines kept",
  compact: "Blank lines dropped",
  manual: "Match lines by hand",
} as const;

// -- Component ----------------------------------------------------------------

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
  const [restoredDraft] = useState(() => {
    const draft = readModalDraft("paste-translations");
    return draft?.pastedText === initialText ? draft : undefined;
  });
  const [kind, setKind] = useState<PasteKind>(restoredDraft?.kind ?? defaultKind);
  const [targetLanguage, setTargetLanguage] = useState(restoredDraft?.targetLanguage ?? defaultTargetLanguage);
  const [showClearDraft, setShowClearDraft] = useState(restoredDraft !== undefined);
  const [pastedText, setPastedText] = useState(restoredDraft?.text ?? initialText);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const alignment = useMemo(
    () =>
      alignPastedLanguageLines(
        pastedText,
        lines.map((line) => line.text),
      ),
    [lines, pastedText],
  );
  const [manualRows, setManualRows] = useState<string[] | null>(restoredDraft?.manualRows ?? null);
  const mappedLines = manualRows ?? alignment.mappedLines;
  const errors = useMemo(
    () =>
      kind === "transliteration"
        ? lines.map((line, index) => validateTransliterationAlignment(line.text, mappedLines[index] ?? "", line.words))
        : lines.map(() => null),
    [kind, lines, mappedLines],
  );
  const errorCount = errors.filter(Boolean).length;
  const rowErrorIdPrefix = useId();
  const mappedCount = mappedLines.filter((line) => line.trim()).length;
  const languageSelectOptions = languageOptions.map(([value, label]) => ({ value, label }));

  const saveDraft = (patch: Partial<Omit<PasteTranslationsDraft, "pastedText">>) =>
    writeModalDraft("paste-translations", {
      pastedText: initialText,
      text: pastedText,
      manualRows,
      kind,
      targetLanguage,
      ...patch,
    });

  const editDraft = (text: string, rows: string[] | null) => {
    setPastedText(text);
    setManualRows(rows);
    saveDraft({ text, manualRows: rows });
  };

  const changeKind = (next: PasteKind) => {
    setKind(next);
    saveDraft({ kind: next });
  };

  const changeTargetLanguage = (next: string) => {
    setTargetLanguage(next);
    saveDraft({ targetLanguage: next });
  };

  const updateMappedLine = (index: number, value: string) => {
    const next = mappedLines.slice();
    next[index] = value;
    editDraft(pastedText, next);
  };

  const clearDraft = () => {
    setPastedText(initialText);
    setManualRows(null);
    setShowClearDraft(false);
    clearModalDraft("paste-translations");
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
          segments: wholeLineSegments(line.text, text),
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
    noteGuideSignal("languages.paste");
    if (kind === "transliteration") noteGuideSignal("languages.romanize");
    if (kind === "translation") onImportedTranslation(targetLanguage);
    toast.success(`Imported ${pluralize(mappedCount, "line")}`);
    clearModalDraft("paste-translations");
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
      <div className="grid h-[min(78vh,48rem)] min-h-0 overflow-y-auto overscroll-none lg:overflow-hidden lg:grid-cols-[minmax(20rem,0.8fr)_minmax(32rem,1.4fr)]">
        <div className="flex min-h-0 flex-col gap-4 p-5 border-b lg:border-b-0 lg:border-r border-(--divider)">
          <div className="flex items-center justify-between gap-3">
            <SegmentedControl aria-label="Import as" value={kind} options={KIND_OPTIONS} onChange={changeKind} />
            {kind === "translation" && (
              <Select
                aria-label="Imported translation language"
                value={targetLanguage}
                onChange={changeTargetLanguage}
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
              onChange={(event) => editDraft(event.target.value, null)}
              spellCheck={false}
              className={cn(INPUT_STYLES, "flex-1 min-h-52 p-3 font-mono leading-6 resize-none")}
            />
          </label>
          <p className="text-xs text-composer-text-muted text-pretty select-none">
            Blank lines are kept if the counts match. If not, they get dropped.
          </p>
        </div>

        <div className="flex min-w-0 min-h-0 flex-col overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-(--divider) select-none">
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
            <div
              role="alert"
              className="px-5 py-2 text-xs border-b border-composer-warning/20 bg-composer-warning/10 text-composer-warning select-text"
            >
              {errorCount > 0
                ? `${pluralize(errorCount, "line doesn't", "lines don't")} fit the timing yet.`
                : alignment.warning}
            </div>
          )}
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-none">
            {lines.map((line, index) => (
              <div
                key={line.id}
                className="grid grid-cols-[2rem_minmax(0,1fr)_1.25rem_minmax(0,1fr)] items-start gap-2 px-5 py-2 border-b border-(--divider)"
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
                    aria-describedby={errors[index] ? `${rowErrorIdPrefix}-${index}` : undefined}
                    value={mappedLines[index] ?? ""}
                    onChange={(event) => updateMappedLine(index, event.target.value)}
                    className={cn(INPUT_STYLES, "w-full")}
                  />
                  <FieldError id={`${rowErrorIdPrefix}-${index}`} message={errors[index] || null} className="mt-1" />
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between gap-3 px-5 py-4 border-t border-(--divider) select-none">
            <div className="flex items-center gap-3">
              {showClearDraft && (
                <Button variant="ghost" size="sm" onClick={clearDraft} className="-ml-3">
                  Clear draft
                </Button>
              )}
              <span className="text-xs text-composer-text-muted tabular-nums">
                {mappedCount} of {lines.length} lines ready
              </span>
            </div>
            <div className="flex gap-2">
              <Button onClick={onClose}>Cancel</Button>
              <Button hasIcon variant="primary" disabled={errorCount > 0 || mappedCount === 0} onClick={importContent}>
                <IconFileImport className="size-4" />
                Import {pluralize(mappedCount, "line")}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};

// -- Exports ------------------------------------------------------------------

export { PasteImportModal };
