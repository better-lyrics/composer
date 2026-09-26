import { getLanguageAlignmentErrorItems } from "@/domain/language/alignment-errors";
import type { LanguageAlignmentErrorField } from "@/domain/language/alignment-errors";
import { getLanguageReviewItems } from "@/domain/language/review";
import type { LanguageReviewTrack } from "@/domain/language/review";
import type { LyricLine } from "@/domain/line/model";
import { LanguageStatusBanner } from "@/views/languages/status-banner";

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
  const errorItems = getLanguageAlignmentErrorItems(lines);
  const reviewItems = getLanguageReviewItems(lines);
  if (errorItems.length === 0 && reviewItems.length === 0) return null;

  const trackName = (track: LanguageReviewTrack) =>
    track.kind === "transliteration" ? "Transliteration" : (languageNames.get(track.language) ?? track.language);

  return (
    <div className="flex flex-col gap-2 px-6 pt-4">
      <LanguageStatusBanner
        tone="error"
        aria-label="Language timing mismatches"
        title={
          errorItems.length === 1 ? "1 line has a timing mismatch" : `${errorItems.length} lines have a timing mismatch`
        }
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
        title={reviewItems.length === 1 ? "1 line needs review" : `${reviewItems.length} lines need review`}
        helper="The lyric changed after these were written."
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
