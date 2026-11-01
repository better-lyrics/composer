import type { AlignmentReview } from "@/domain/alignment/review-state";
import { Button } from "@/ui/button";
import {
  MOSTLY_UNREVIEWED_REST,
  UNREVIEWED_INSTRUCTION,
  UNREVIEWED_REASON,
  UNREVIEWED_TITLE,
  untouchedShare,
} from "@/views/export/alignment-review-copy";
import type { AlignmentNotice } from "@/views/export/use-alignment-review";
import { IconAlertOctagon, IconInfoCircle, IconLayoutRows, IconX } from "@tabler/icons-react";

// -- Interfaces ---------------------------------------------------------------

interface AlignmentReviewNoticeProps {
  notice: AlignmentNotice;
  review: AlignmentReview;
  onReview: () => void;
  onDismiss: () => void;
}

// -- Components ---------------------------------------------------------------

const ReviewButton: React.FC<{ onReview: () => void; size: "sm" | "md" }> = ({ onReview, size }) => (
  <Button hasIcon size={size} onClick={onReview} className="shrink-0">
    <IconLayoutRows className="size-4" />
    Review in Timeline
  </Button>
);

const UnreviewedNotice: React.FC<{ onReview: () => void }> = ({ onReview }) => (
  <div
    role="alert"
    className="flex shrink-0 items-center gap-4 py-3.5 pr-3.5 pl-4 rounded-xl bg-composer-error/10 shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--color-composer-error)_28%,transparent)]"
  >
    <div className="flex min-w-0 items-start gap-3">
      <IconAlertOctagon aria-hidden="true" className="mt-px size-5 shrink-0 text-composer-error" />
      <div className="flex min-w-0 max-w-[68ch] flex-col gap-1 select-text cursor-text">
        <p className="text-sm font-semibold leading-5 text-composer-error-text">{UNREVIEWED_TITLE}</p>
        <p className="text-[13px] leading-5 text-pretty text-[color-mix(in_oklab,var(--color-composer-error-text)_80%,var(--color-composer-bg))]">
          {UNREVIEWED_REASON} {UNREVIEWED_INSTRUCTION}
        </p>
      </div>
    </div>
    <span className="ml-auto">
      <ReviewButton size="md" onReview={onReview} />
    </span>
  </div>
);

const MostlyUnreviewedNotice: React.FC<{ review: AlignmentReview; onReview: () => void; onDismiss: () => void }> = ({
  review,
  onReview,
  onDismiss,
}) => (
  <div
    role="status"
    className="flex shrink-0 items-center gap-3 py-3.5 pr-3.5 pl-4 rounded-xl bg-(--layer-1) shadow-[inset_0_0_0_1px_var(--edge)]"
  >
    <IconInfoCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0 self-start text-(--muted)" />
    <p className="min-w-0 max-w-[75ch] text-[13px] leading-5 text-pretty text-(--label) select-text cursor-text">
      <span className="font-medium text-composer-text tabular-nums">
        {untouchedShare(review.untouchedCount, review.timedCount)}
      </span>{" "}
      {MOSTLY_UNREVIEWED_REST}
    </p>
    <span className="ml-auto flex shrink-0 items-center gap-1">
      <ReviewButton size="sm" onReview={onReview} />
      <Button hasIcon size="sm" variant="ghost" onClick={onDismiss}>
        <IconX className="size-4" />
        Dismiss
      </Button>
    </span>
  </div>
);

const AlignmentReviewNotice: React.FC<AlignmentReviewNoticeProps> = ({ notice, review, onReview, onDismiss }) => {
  if (notice === "unreviewed") return <UnreviewedNotice onReview={onReview} />;
  if (notice === "mostly-unreviewed") {
    return <MostlyUnreviewedNotice review={review} onReview={onReview} onDismiss={onDismiss} />;
  }
  return null;
};

// -- Exports ------------------------------------------------------------------

export { AlignmentReviewNotice };
