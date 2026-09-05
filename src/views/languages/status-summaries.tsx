import { getLanguageAlignmentErrorItems } from "@/domain/language/alignment-errors";
import { getLanguageReviewItems } from "@/domain/language/review";
import type { LyricLine } from "@/domain/line/model";
import { LanguageAlignmentErrorSummary } from "@/views/languages/alignment-error-summary";
import { LanguageReviewSummary } from "@/views/languages/review-summary";

interface LanguageStatusSummariesProps {
  lines: LyricLine[];
  languageNames: ReadonlyMap<string, string>;
}

const LanguageStatusSummaries: React.FC<LanguageStatusSummariesProps> = ({ lines, languageNames }) => (
  <>
    <LanguageAlignmentErrorSummary items={getLanguageAlignmentErrorItems(lines)} />
    <LanguageReviewSummary items={getLanguageReviewItems(lines)} languageNames={languageNames} />
  </>
);

export { LanguageStatusSummaries };
