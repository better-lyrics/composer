import { getAgentColor } from "@/domain/agent/colors";
import { alignTrackToLine } from "@/domain/language/align";
import { getLanguageAlignmentErrors } from "@/domain/language/alignment-errors";
import { languageSourceFingerprint } from "@/domain/language/fingerprint";
import { manualSegments } from "@/domain/language/manual-segments";
import type { TranslationTrack } from "@/domain/language/model";
import { alignmentNeedsReview, getLanguageReviewTracks, languageLineAnchorId } from "@/domain/language/review";
import type { LyricLine } from "@/domain/line/model";
import { useProjectStore } from "@/stores/project";
import { StatusChip } from "@/ui/status-chip";
import { cn } from "@/utils/cn";
import { AlignButton, BackgroundLanguageFields } from "@/views/languages/background-language-fields";
import { LanguageField as Field } from "@/views/languages/language-field";
import { type AlignmentField, TransliterationAlignmentModal } from "@/views/languages/transliteration-alignment-modal";
import { IconAlertCircle, IconAlertTriangle } from "@tabler/icons-react";
import { useState } from "react";

// -- Interfaces ---------------------------------------------------------------

interface LanguageLineEditorProps {
  line: LyricLine;
  index: number;
  targets: string[];
  languageNames: ReadonlyMap<string, string>;
  sourceLanguage?: string;
}

// -- Components ---------------------------------------------------------------

const LanguageLineEditor: React.FC<LanguageLineEditorProps> = ({
  line,
  index,
  targets,
  languageNames,
  sourceLanguage,
}) => {
  const updateLine = useProjectStore((state) => state.updateLine);
  const [alignmentField, setAlignmentField] = useState<AlignmentField | null>(null);
  const fingerprint = languageSourceFingerprint(line.text, line.backgroundText);
  const needsReview = getLanguageReviewTracks(line).length > 0;
  const alignmentErrors = getLanguageAlignmentErrors(line);
  const transliterationError = alignmentErrors.find((error) => error.field === "transliteration")?.message;
  const backgroundTransliterationError = alignmentErrors.find(
    (error) => error.field === "background-transliteration",
  )?.message;
  const hasAlignmentError = alignmentErrors.length > 0;
  const transliterationStale = line.transliteration
    ? line.transliteration.sourceFingerprint !== fingerprint || alignmentNeedsReview(line.transliteration, "main")
    : false;
  const canAlignMain = Boolean(line.words?.length && line.transliteration?.text && !transliterationError);
  const update = (updates: Partial<LyricLine>) => updateLine(line.id, updates, { deriveText: false });
  const clearTransliteration = () =>
    update({
      ...(line.transliteration
        ? alignTrackToLine(line, { ...line.transliteration, text: "", backgroundText: undefined })
        : {}),
      transliteration: undefined,
    });

  return (
    <section
      id={languageLineAnchorId(line.id)}
      className={cn(
        "grid grid-cols-[3rem_17.5rem_minmax(0,1fr)] border-b border-(--divider) scroll-mt-4",
        hasAlignmentError ? "bg-composer-error/[0.08]" : needsReview && "bg-composer-warning/[0.04]",
      )}
    >
      <span
        className="line-cell text-center font-mono font-medium text-xs text-(--muted) tabular-nums select-none [box-shadow:inset_-2px_0_0_var(--rail)]"
        style={{ "--agent": getAgentColor(line.agentId) }}
      >
        <span className="flex h-12 items-center justify-center">{index + 1}</span>
      </span>
      <div className="flex min-w-0 flex-col items-start gap-1.5 py-3.5 px-4">
        <span className="max-w-full text-sm leading-5 wrap-anywhere select-text">{line.text}</span>
        {line.backgroundText && (
          <span className="max-w-full text-[13px] italic text-(--muted) wrap-anywhere select-text">
            {line.backgroundText}
          </span>
        )}
        {hasAlignmentError && (
          <StatusChip tone="error" icon={IconAlertCircle}>
            Timing mismatch
          </StatusChip>
        )}
        {needsReview && (
          <StatusChip tone="warning" icon={IconAlertTriangle}>
            Needs review
          </StatusChip>
        )}
      </div>
      <div className="flex min-w-0 flex-col gap-1.5 py-2 pr-4">
        <Field
          label="Transliteration"
          mono
          value={line.transliteration?.text ?? ""}
          placeholder="Type one, or regenerate"
          status={transliterationStale ? "review" : undefined}
          error={transliterationError}
          pasteKind="transliteration"
          action={
            canAlignMain ? (
              <AlignButton
                needsReview={alignmentNeedsReview(line.transliteration, "main")}
                onClick={() => setAlignmentField("words")}
              />
            ) : null
          }
          onChange={(value) => {
            if (!value && !line.transliteration?.backgroundText) {
              clearTransliteration();
              return;
            }
            update(
              alignTrackToLine(line, {
                language: line.transliteration?.language ?? `${sourceLanguage || "und"}-Latn`,
                text: value,
                backgroundText: line.transliteration?.backgroundText,
                segments: manualSegments(line, value),
                backgroundSegments: line.transliteration?.backgroundSegments,
                origin: "manual",
                sourceFingerprint: fingerprint,
              }),
            );
          }}
        />
        {targets.map((language) => {
          const track = line.translations?.[language];
          return (
            <Field
              key={language}
              label={languageNames.get(language) ?? language}
              value={track?.text ?? ""}
              status={track && track.sourceFingerprint !== fingerprint ? "review" : undefined}
              pasteKind="translation"
              pasteLanguage={language}
              onChange={(value) => {
                const translations = { ...(line.translations ?? {}) };
                if (value || track?.backgroundText)
                  translations[language] = {
                    language,
                    text: value,
                    backgroundText: track?.backgroundText,
                    origin: "manual",
                    sourceFingerprint: fingerprint,
                  } satisfies TranslationTrack;
                else delete translations[language];
                update({ translations });
              }}
            />
          );
        })}
        {line.backgroundText && (
          <BackgroundLanguageFields
            line={line}
            targets={targets}
            languageNames={languageNames}
            sourceLanguage={sourceLanguage}
            fingerprint={fingerprint}
            error={backgroundTransliterationError}
            update={update}
            clearTransliteration={clearTransliteration}
            onAlign={setAlignmentField}
          />
        )}
      </div>
      {alignmentField && (
        <TransliterationAlignmentModal line={line} field={alignmentField} onClose={() => setAlignmentField(null)} />
      )}
    </section>
  );
};

// -- Exports ------------------------------------------------------------------

export { LanguageLineEditor };
