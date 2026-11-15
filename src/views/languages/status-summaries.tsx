import { getLanguageAlignmentErrorItems } from "insync/language-alignment-errors";
import type { LanguageAlignmentErrorField } from "insync/language-alignment-errors";
import { getLanguageReviewItems } from "insync/language-review";
import type { LanguageReviewTrack } from "insync/language-review";
import type { LyricLine } from "insync/line";
import { LanguageStatusBanner } from "@/views/languages/status-banner";
import { pluralize } from "insync/pluralize";
import { getSplitCharacter } from "@/utils/split-character";

// -- Interfaces ---------------------------------------------------------------

interface LanguageStatusSummariesProps {
  lines: LyricLine[];
  languageNames: ReadonlyMap<string, string>;
}

// -- Helpers ------------------------------------------------------------------

function fieldName(field: LanguageAlignmentErrorField): string {
  return field === "transliteration" ? "Transliteration" : "Background transliteration";
}

// -- Component ----------------------------------------------------------------

const LanguageStatusSummaries: React.FC<LanguageStatusSummariesProps> = ({ lines, languageNames }) => {
  const errorItems = getLanguageAlignmentErrorItems(lines, getSplitCharacter());
  const reviewItems = getLanguageReviewItems(lines, getSplitCharacter());
  const reasons = new Set(reviewItems.flatMap((item) => item.tracks.flatMap((track) => track.reasons)));
  const reviewHelper = reasons.has("source-changed")
    ? reasons.has("alignment")
      ? "Some lyrics changed, and some transliteration boundaries need checking."
      : "The lyric changed after these were written."
    : "Check the estimated transliteration boundaries with Align.";
  if (errorItems.length === 0 && reviewItems.length === 0) return null;

  const trackName = (track: LanguageReviewTrack) =>
    track.kind === "transliteration" ? "Transliteration" : (languageNames.get(track.language) ?? track.language);

  return (
    <div className="flex flex-col gap-2 px-4 pt-4 pb-3">
      <LanguageStatusBanner
        tone="error"
        aria-label="Language timing mismatches"
        title={`${pluralize(errorItems.length, "line has", "lines have")} a timing mismatch`}
        helper="Fix the text, then press Align."
        items={errorItems.map((item) => ({
          lineId: item.lineId,
          lineIndex: item.lineIndex,
          detail: item.errors.map((error) => fieldName(error.field)).join(", "),
        }))}
      />
      <LanguageStatusBanner
        tone="warning"
        aria-label="Language content needing review"
        title={`${pluralize(reviewItems.length, "line needs", "lines need")} review`}
        helper={reviewHelper}
        items={reviewItems.map((item) => ({
          lineId: item.lineId,
          lineIndex: item.lineIndex,
          detail: item.tracks.map(trackName).join(", "),
        }))}
      />
    </div>
  );
};

// -- Exports ------------------------------------------------------------------

export { LanguageStatusSummaries };
