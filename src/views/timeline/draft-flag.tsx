import { isFlaggedDraft } from "@/domain/alignment/draft-timing";
import type { LyricLine } from "@/domain/line/model";
import { useDraftReviewStore } from "@/stores/draft-review";
import { Tooltip } from "@/ui/tooltip";
import { IconAlertTriangle } from "@tabler/icons-react";

// -- Component -----------------------------------------------------------------

function useFlagged(line: LyricLine): boolean {
  const mark = useDraftReviewStore((s) => s.marks[line.id]);
  return isFlaggedDraft(line, mark);
}

// A drafted line the user should check gets a warning in its gutter and a tint
// over its row, until the line is edited.
const DraftFlagIcon: React.FC<{ line: LyricLine }> = ({ line }) => {
  if (!useFlagged(line)) return null;
  return (
    <Tooltip content="Drafted without taps and may be off. Check it; once you fix it, it stays put." placement="right">
      <span
        role="img"
        aria-label="Drafted line to check"
        className="absolute bottom-1 left-1 grid place-items-center size-4 text-composer-warning"
      >
        <IconAlertTriangle aria-hidden="true" className="size-3.5" />
      </span>
    </Tooltip>
  );
};

const DraftFlagTint: React.FC<{ line: LyricLine }> = ({ line }) => {
  if (!useFlagged(line)) return null;
  return (
    <div
      aria-hidden
      className="absolute inset-y-0 left-12 right-0 pointer-events-none bg-composer-warning/8 shadow-[inset_2px_0_0_var(--color-composer-warning)]"
    />
  );
};

// -- Exports -------------------------------------------------------------------

export { DraftFlagIcon, DraftFlagTint };
