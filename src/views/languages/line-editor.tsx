import { alignTrackToLine } from "@/domain/language/align";
import { getLanguageAlignmentErrors } from "@/domain/language/alignment-errors";
import { languageSourceFingerprint } from "@/domain/language/fingerprint";
import type { TranslationTrack, TransliterationSegment } from "@/domain/language/model";
import { getLanguageReviewTracks, languageLineAnchorId } from "@/domain/language/review";
import type { LyricLine } from "@/domain/line/model";
import { useProjectStore } from "@/stores/project";
import { Button } from "@/ui/button";
import { StatusChip } from "@/ui/status-chip";
import { cn } from "@/utils/cn";
import { LanguageField as Field } from "@/views/languages/language-field";
import { type AlignmentField, TransliterationAlignmentModal } from "@/views/languages/transliteration-alignment-modal";
import { IconAlertCircle, IconAlertTriangle, IconSeparatorVertical } from "@tabler/icons-react";
import { useState } from "react";

function manualSegments(line: LyricLine, value: string): TransliterationSegment[] {
  return value.trim() ? [{ original: line.text, transliteration: value.trim() }] : [];
}

interface LanguageLineEditorProps {
  line: LyricLine;
  index: number;
  targets: string[];
  languageNames: ReadonlyMap<string, string>;
  sourceLanguage?: string;
}

interface BackgroundLanguageFieldsProps extends Omit<LanguageLineEditorProps, "index"> {
  fingerprint: string;
  error?: string;
  update: (updates: Partial<LyricLine>) => void;
  clearTransliteration: () => void;
  onAlign: (field: AlignmentField) => void;
}

// -- Components ---------------------------------------------------------------

const AlignButton: React.FC<{ onClick: () => void; ariaLabel?: string }> = ({ onClick, ariaLabel }) => (
  <Button variant="ghost" size="sm" hasIcon aria-label={ariaLabel} onClick={onClick}>
    <IconSeparatorVertical className="size-4" />
    Align
  </Button>
);

const BackgroundLanguageFields: React.FC<BackgroundLanguageFieldsProps> = ({
  line,
  targets,
  languageNames,
  sourceLanguage,
  fingerprint,
  error,
  update,
  clearTransliteration,
  onAlign,
}) => (
  <div className="mt-1 flex flex-col gap-1.5 pt-2 border-t border-dashed border-composer-border">
    <p className="text-xs text-composer-text-faint select-none">Background</p>
    <Field
      label="Transliteration"
      ariaLabel="Background transliteration"
      mono
      value={line.transliteration?.backgroundText ?? ""}
      status={line.transliteration?.backgroundAlignmentStatus === "needs-review" ? "review" : undefined}
      error={error}
      pasteKind="transliteration"
      action={
        line.backgroundWords?.length && line.transliteration?.backgroundText && !error ? (
          <AlignButton ariaLabel="Align background timing" onClick={() => onAlign("backgroundWords")} />
        ) : null
      }
      onChange={(value) => {
        const current = line.transliteration;
        if (!value && !current?.text) {
          clearTransliteration();
          return;
        }
        update(
          alignTrackToLine(line, {
            language: `${sourceLanguage || "und"}-Latn`,
            text: "",
            segments: [],
            ...current,
            backgroundText: value,
            backgroundSegments: value.trim()
              ? [{ original: line.backgroundText ?? "", transliteration: value.trim() }]
              : [],
            origin: "manual",
            sourceFingerprint: fingerprint,
          }),
        );
      }}
    />
    {targets.map((language) => {
      const track = line.translations?.[language];
      const name = languageNames.get(language) ?? language;
      return (
        <Field
          key={language}
          label={name}
          ariaLabel={`Background ${name}`}
          value={track?.backgroundText ?? ""}
          pasteKind="translation"
          pasteLanguage={language}
          onChange={(value) => {
            const translations = { ...line.translations };
            if (!value && !track?.text) {
              delete translations[language];
              update({ translations });
              return;
            }
            update({
              translations: {
                ...translations,
                [language]: {
                  language,
                  text: "",
                  ...track,
                  backgroundText: value,
                  origin: "manual",
                  sourceFingerprint: fingerprint,
                },
              },
            });
          }}
        />
      );
    })}
  </div>
);

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
    ? line.transliteration.sourceFingerprint !== fingerprint || line.transliteration.alignmentStatus === "needs-review"
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
        "grid grid-cols-[2.5rem_minmax(10rem,18rem)_minmax(0,1fr)] gap-x-4 px-6 py-3 border-t border-composer-border scroll-mt-4",
        hasAlignmentError ? "bg-composer-error/[0.08]" : needsReview && "bg-composer-warning/[0.04]",
      )}
    >
      <span className="pt-1.5 font-mono text-xs text-composer-text-muted tabular-nums select-none">{index + 1}</span>
      <div className="flex min-w-0 flex-col items-start gap-1.5 pt-1">
        <span className="text-sm leading-6 select-text">{line.text}</span>
        {line.backgroundText && (
          <span className="text-sm text-composer-text-muted select-text">{line.backgroundText}</span>
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
      <div className="flex min-w-0 flex-col gap-1.5">
        <Field
          label="Transliteration"
          mono
          value={line.transliteration?.text ?? ""}
          placeholder="Type one, or regenerate"
          status={transliterationStale ? "review" : undefined}
          error={transliterationError}
          pasteKind="transliteration"
          action={canAlignMain ? <AlignButton onClick={() => setAlignmentField("words")} /> : null}
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

export { LanguageLineEditor };
