import { IconSeparatorVertical } from "@tabler/icons-react";
import { alignTrackToLine } from "@/domain/language/align";
import { lineTranslations, lineTransliteration, withLanguages } from "@/domain/language/line-languages";
import type { LineLanguage } from "@/domain/language/model";
import { alignmentNeedsReview, isTransliterationSourceStale } from "@/domain/language/review";
import type { LyricLine } from "@/domain/line/model";
import { backgroundText } from "@/domain/line/text";
import { backgroundTrack, timedSyllables } from "@/domain/line/track";
import { Button } from "@/ui/button";
import { cn } from "@/utils/cn";
import { LanguageField as Field } from "@/views/languages/language-field";
import type { AlignmentField } from "@/views/languages/transliteration-alignment-modal";

// -- Interfaces ---------------------------------------------------------------

interface BackgroundLanguageFieldsProps {
  line: LyricLine;
  targets: string[];
  languageNames: ReadonlyMap<string, string>;
  sourceLanguage?: string;
  fingerprint: string;
  error?: string;
  update: (updates: Partial<LyricLine>) => void;
  clearTransliteration: () => void;
  onAlign: (field: AlignmentField) => void;
}

// -- Components ---------------------------------------------------------------

const AlignButton: React.FC<{ onClick: () => void; ariaLabel?: string; needsReview?: boolean }> = ({
  onClick,
  ariaLabel,
  needsReview,
}) => (
  <Button
    variant="ghost"
    size="sm"
    hasIcon
    aria-label={ariaLabel}
    className={cn(
      "text-[13px] pr-2.5 hover:bg-(--layer-2) hover:text-composer-text",
      needsReview && "text-composer-accent-text hover:text-composer-accent-text",
    )}
    onClick={onClick}
  >
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
}) => {
  const transliteration = lineTransliteration(line);
  return (
    <div className="mt-1 flex flex-col gap-1.5 pt-2 border-t border-dashed border-(--divider)">
      <p className="text-xs text-composer-text-muted select-none">Background</p>
      <Field
        label="Transliteration"
        ariaLabel="Background transliteration"
        mono
        value={transliteration?.bg?.text ?? ""}
        status={
          isTransliterationSourceStale(line, "backgroundWords") || alignmentNeedsReview(transliteration, "background")
            ? "review"
            : undefined
        }
        error={error}
        pasteKind="transliteration"
        action={
          timedSyllables(backgroundTrack(line)).length && transliteration?.bg?.text && !error ? (
            <AlignButton
              ariaLabel="Align background timing"
              needsReview={alignmentNeedsReview(transliteration, "background")}
              onClick={() => onAlign("backgroundWords")}
            />
          ) : null
        }
        onChange={(value) => {
          const current = transliteration;
          if (!value && !current?.main.text) {
            clearTransliteration();
            return;
          }
          const main = current?.main ?? { text: "", segments: [] };
          update(
            alignTrackToLine(line, {
              language: `${sourceLanguage || "und"}-Latn`,
              ...current,
              main: { ...main, reviewedSourceFingerprint: undefined },
              bg: {
                ...current?.bg,
                text: value,
                segments: value.trim() ? [{ original: backgroundText(line) ?? "", transliteration: value.trim() }] : [],
                reviewedSourceFingerprint: undefined,
              },
              origin: "manual",
              sourceFingerprint: fingerprint,
            }),
          );
        }}
      />
      {targets.map((language) => {
        const track = lineTranslations(line)?.[language];
        const name = languageNames.get(language) ?? language;
        return (
          <Field
            key={language}
            label={name}
            ariaLabel={`Background ${name}`}
            value={track?.bg?.text ?? ""}
            pasteKind="translation"
            pasteLanguage={language}
            onChange={(value) => {
              const translations = { ...lineTranslations(line) };
              if (!value && !track?.main.text) {
                delete translations[language];
                update(withLanguages(line, { translations }));
                return;
              }
              const translation: LineLanguage = {
                language,
                main: { text: "" },
                ...track,
                bg: { ...track?.bg, text: value },
                origin: "manual",
                sourceFingerprint: fingerprint,
              };
              update(withLanguages(line, { translations: { ...translations, [language]: translation } }));
            }}
          />
        );
      })}
    </div>
  );
};

// -- Exports ------------------------------------------------------------------

export { AlignButton, BackgroundLanguageFields };
