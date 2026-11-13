import { IconAlertCircle, IconAlertTriangle } from "@tabler/icons-react";
import { useState } from "react";
import { getAgentColor } from "@/domain/agent/colors";
import { setLanguageFields } from "@/domain/commands/languages";
import { alignTrackToLine } from "@/domain/language/align";
import { getLanguageAlignmentErrors } from "@/domain/language/alignment-errors";
import { languageSourceFingerprint } from "@/domain/language/fingerprint";
import {
  lineTranslations,
  lineTransliteration,
  withLanguages,
  withoutTransliteration,
} from "@/domain/language/line-languages";
import { manualSegments } from "@/domain/language/manual-segments";
import type { LineLanguage } from "@/domain/language/model";
import {
  alignmentNeedsReview,
  getLanguageReviewTracks,
  isTransliterationSourceStale,
  languageLineAnchorId,
} from "@/domain/language/review";
import type { LyricLine } from "@/domain/line/model";
import { backgroundText, lineText } from "@/domain/line/text";
import { mainTrack, timedSyllables } from "@/domain/line/track";
import { useProjectStore } from "@/stores/project";
import { StatusChip } from "@/ui/status-chip";
import { cn } from "@/utils/cn";
import { AlignButton, BackgroundLanguageFields } from "@/views/languages/background-language-fields";
import { LanguageField as Field } from "@/views/languages/language-field";
import { type AlignmentField, TransliterationAlignmentModal } from "@/views/languages/transliteration-alignment-modal";

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
  const [alignmentField, setAlignmentField] = useState<AlignmentField | null>(null);
  const fingerprint = languageSourceFingerprint(lineText(line), backgroundText(line));
  const needsReview = getLanguageReviewTracks(line).length > 0;
  const alignmentErrors = getLanguageAlignmentErrors(line);
  const transliterationError = alignmentErrors.find((error) => error.field === "transliteration")?.message;
  const backgroundTransliterationError = alignmentErrors.find(
    (error) => error.field === "background-transliteration",
  )?.message;
  const hasAlignmentError = alignmentErrors.length > 0;
  const transliteration = lineTransliteration(line);
  const transliterationStale = transliteration
    ? isTransliterationSourceStale(line, "words") || alignmentNeedsReview(transliteration, "main")
    : false;
  const canAlignMain = Boolean(
    timedSyllables(mainTrack(line)).length && transliteration?.main.text && !transliterationError,
  );
  const update = (updates: Partial<LyricLine>) =>
    useProjectStore.getState().commit(setLanguageFields(line.id, updates), "pending");
  const clearTransliteration = () => update(withoutTransliteration(line));

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
        <span className="max-w-full text-sm leading-5 wrap-anywhere select-text">{lineText(line)}</span>
        {backgroundText(line) && (
          <span className="max-w-full text-[13px] italic text-(--muted) wrap-anywhere select-text">
            {backgroundText(line)}
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
          value={transliteration?.main.text ?? ""}
          placeholder="Type one, or generate"
          status={transliterationStale ? "review" : undefined}
          error={transliterationError}
          pasteKind="transliteration"
          action={
            canAlignMain ? (
              <AlignButton
                needsReview={alignmentNeedsReview(transliteration, "main")}
                onClick={() => setAlignmentField("words")}
              />
            ) : null
          }
          onChange={(value) => {
            const bg = transliteration?.bg;
            if (!value && !bg?.text) {
              clearTransliteration();
              return;
            }
            update(
              alignTrackToLine(line, {
                language: transliteration?.language ?? `${sourceLanguage || "und"}-Latn`,
                main: { text: value, segments: manualSegments(line, value) },
                ...(bg && { bg: { text: bg.text, ...(bg.segments && { segments: bg.segments }) } }),
                origin: "manual",
                sourceFingerprint: fingerprint,
              }),
            );
          }}
        />
        {targets.map((language) => {
          const track = lineTranslations(line)?.[language];
          return (
            <Field
              key={language}
              label={languageNames.get(language) ?? language}
              value={track?.main.text ?? ""}
              status={track && track.sourceFingerprint !== fingerprint ? "review" : undefined}
              pasteKind="translation"
              pasteLanguage={language}
              onChange={(value) => {
                const translations = { ...(lineTranslations(line) ?? {}) };
                if (value || track?.bg?.text)
                  translations[language] = {
                    language,
                    main: { text: value },
                    ...(track?.bg && { bg: { text: track.bg.text } }),
                    origin: "manual",
                    sourceFingerprint: fingerprint,
                  } satisfies LineLanguage;
                else delete translations[language];
                update(withLanguages(line, { translations }));
              }}
            />
          );
        })}
        {backgroundText(line) && (
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
