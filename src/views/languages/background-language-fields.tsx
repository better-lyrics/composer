import { alignTrackToLine } from "@/domain/language/align";
import { alignmentNeedsReview } from "@/domain/language/review";
import type { LyricLine } from "@/domain/line/model";
import { Button } from "@/ui/button";
import { cn } from "@/utils/cn";
import { LanguageField as Field } from "@/views/languages/language-field";
import type { AlignmentField } from "@/views/languages/transliteration-alignment-modal";
import { IconSeparatorVertical } from "@tabler/icons-react";

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
}) => (
  <div className="mt-1 flex flex-col gap-1.5 pt-2 border-t border-dashed border-(--divider)">
    <p className="text-xs text-composer-text-muted select-none">Background</p>
    <Field
      label="Transliteration"
      ariaLabel="Background transliteration"
      mono
      value={line.transliteration?.backgroundText ?? ""}
      status={alignmentNeedsReview(line.transliteration, "background") ? "review" : undefined}
      error={error}
      pasteKind="transliteration"
      action={
        line.backgroundWords?.length && line.transliteration?.backgroundText && !error ? (
          <AlignButton
            ariaLabel="Align background timing"
            needsReview={alignmentNeedsReview(line.transliteration, "background")}
            onClick={() => onAlign("backgroundWords")}
          />
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

// -- Exports ------------------------------------------------------------------

export { AlignButton, BackgroundLanguageFields };
