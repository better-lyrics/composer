import { alignTrackToLine } from "@/domain/language/align";
import { getLanguageAlignmentErrors } from "@/domain/language/alignment-errors";
import { languageSourceFingerprint } from "@/domain/language/fingerprint";
import type { TranslationTrack, TransliterationSegment } from "@/domain/language/model";
import { getLanguageReviewTracks, languageLineAnchorId } from "@/domain/language/review";
import type { LyricLine } from "@/domain/line/model";
import { useProjectStore } from "@/stores/project";
import { LanguageField as Field } from "@/views/languages/language-field";
import { type AlignmentField, TransliterationAlignmentModal } from "@/views/languages/transliteration-alignment-modal";
import { IconAlertCircle, IconAlertTriangle } from "@tabler/icons-react";
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
  <div className="mt-3 pl-4 border-l border-composer-border">
    <p className="mb-2 text-xs text-composer-text-muted">Background: {line.backgroundText}</p>
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      <Field
        label="Background transliteration"
        value={line.transliteration?.backgroundText ?? ""}
        stale={line.transliteration?.backgroundAlignmentStatus === "needs-review"}
        error={error}
        pasteKind="transliteration"
        action={
          line.backgroundWords?.length && line.transliteration?.backgroundText && !error ? (
            <button
              type="button"
              onClick={() => onAlign("backgroundWords")}
              className="rounded px-1.5 py-0.5 font-medium text-composer-accent-text hover:bg-composer-accent/10"
            >
              Align timing
            </button>
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
        return (
          <Field
            key={language}
            label={`Background ${languageNames.get(language) ?? language}`}
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
      className={`p-4 border rounded-lg scroll-mt-4 ${
        hasAlignmentError
          ? "border-red-400/35 bg-red-400/[0.035]"
          : needsReview
            ? "border-amber-400/35 bg-amber-400/[0.035]"
            : "border-composer-border bg-composer-bg-elevated"
      }`}
    >
      <div className="flex items-start justify-between gap-3 mb-3 text-sm">
        <div className="min-w-0">
          <span className="mr-3 font-mono text-xs text-composer-text-muted">{index + 1}</span>
          {line.text}
        </div>
        <span className="flex shrink-0 items-center gap-3">
          {hasAlignmentError && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-red-300">
              <IconAlertCircle aria-hidden="true" className="size-3.5" />
              Error
            </span>
          )}
          {needsReview && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-300">
              <IconAlertTriangle aria-hidden="true" className="size-3.5" />
              Review
            </span>
          )}
        </span>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <Field
          label="Transliteration"
          value={line.transliteration?.text ?? ""}
          placeholder="Generated automatically when available"
          stale={
            line.transliteration
              ? line.transliteration.sourceFingerprint !== fingerprint ||
                line.transliteration.alignmentStatus === "needs-review"
              : false
          }
          error={transliterationError}
          pasteKind="transliteration"
          action={
            line.words?.length && line.transliteration?.text && !transliterationError ? (
              <button
                type="button"
                onClick={() => setAlignmentField("words")}
                className="rounded px-1.5 py-0.5 font-medium text-composer-accent-text hover:bg-composer-accent/10"
              >
                Align timing
              </button>
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
              stale={track ? track.sourceFingerprint !== fingerprint : false}
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
      </div>
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
      {alignmentField && (
        <TransliterationAlignmentModal line={line} field={alignmentField} onClose={() => setAlignmentField(null)} />
      )}
    </section>
  );
};

export { LanguageLineEditor };
