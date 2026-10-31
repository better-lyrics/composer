import { draftRoles, isFlaggedDraft } from "@/domain/alignment/draft-timing";
import { mainBounds } from "@/domain/line/bounds";
import { livePlaybackTime, useAudioStore } from "@/stores/audio";
import { useDraftReviewStore } from "@/stores/draft-review";
import { useProjectStore } from "@/stores/project";
import { useSeparationStore } from "@/stores/separation";
import { PopButton, PopGroup, PopRow } from "@/ui/pop-layout";
import { pluralize } from "@/utils/pluralize";
import { IconAlertTriangle, IconSparkles } from "@tabler/icons-react";
import { useMemo } from "react";

// -- Functions -----------------------------------------------------------------

// The next line to check after the playhead, wrapping round to the first.
function seekToNextFlagged(begins: readonly number[]): void {
  const now = livePlaybackTime();
  const next = begins.find((begin) => begin > now + 0.05) ?? begins[0];
  if (next !== undefined) useAudioStore.getState().seekTo(next);
}

// -- Component -----------------------------------------------------------------

// Line timing without taps, for the user to review: an alternative to tapping
// every line before auto-align.
const DraftTimingsGroup: React.FC<{ onDraft: () => void }> = ({ onDraft }) => {
  const lines = useProjectStore((s) => s.lines);
  const marks = useDraftReviewStore((s) => s.marks);
  const lowConfidence = useDraftReviewStore((s) => s.lowConfidence);
  const hasVocals = useSeparationStore((s) => !!s.stemUrls.vocals);
  const toPlace = useMemo(
    () => draftRoles(lines, marks).filter((role) => role.kind === "place").length,
    [lines, marks],
  );
  const flaggedBegins = useMemo(
    () =>
      lines.flatMap((line) => {
        const bounds = isFlaggedDraft(line, marks[line.id]) ? mainBounds(line) : null;
        return bounds ? [bounds.begin] : [];
      }),
    [lines, marks],
  );

  return (
    <PopGroup label="No line timing yet?" className="mt-4 pt-3 border-t border-(--divider)">
      <PopRow
        label="Draft line timings"
        icon={IconSparkles}
        hint={
          toPlace > 0
            ? `Places ${pluralize(toPlace, "line")} without timing of your own from the vocals, then aligns their words. Lines you've timed or fixed stay put. Takes a few minutes.`
            : "Every line is timed. Lines you edit stay put."
        }
      >
        <PopButton disabled={toPlace === 0 || !hasVocals} onClick={onDraft}>
          Draft
        </PopButton>
      </PopRow>
      {flaggedBegins.length > 0 && (
        <PopRow
          label={`${pluralize(flaggedBegins.length, "line")} to check`}
          icon={IconAlertTriangle}
          hint={
            lowConfidence ? (
              <span className="text-composer-warning">
                The draft scored low across the song. Tapping is recommended: tap the first line after each break, then
                draft again.
              </span>
            ) : (
              "Marked in the Timeline. A line you fix stays put on the next draft."
            )
          }
        >
          <PopButton onClick={() => seekToNextFlagged(flaggedBegins)}>Next</PopButton>
        </PopRow>
      )}
    </PopGroup>
  );
};

// -- Exports -------------------------------------------------------------------

export { DraftTimingsGroup };
