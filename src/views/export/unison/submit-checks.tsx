import type { AlignmentReview } from "@/domain/alignment/review-state";
import type { SubmitCheck, SubmitCheckStatus } from "@/domain/unison/submit-checks";
import type { UnisonTtmlProblem } from "@/domain/unison/ttml-precheck";
import { Button } from "@/ui/button";
import { cn } from "@/utils/cn";
import { formatTime } from "@/utils/format-time";
import { pluralize } from "@/utils/pluralize";
import { UNREVIEWED_REASON, UNREVIEWED_TITLE } from "@/views/export/alignment-review-copy";
import { IconChevronDown, IconCircleCheckFilled, IconCircleXFilled, IconInfoCircleFilled } from "@tabler/icons-react";

// -- Interfaces ----------------------------------------------------------------

interface CheckActions {
  reviewInTimeline: () => void;
  regenerate: () => void;
}

interface CheckListProps extends CheckActions {
  checks: readonly SubmitCheck[];
  alignmentTier: AlignmentReview["tier"];
  isrc: string | undefined;
}

interface CheckCopy {
  title: string;
  detail?: string;
  action?: { label: string; run: () => void };
}

// -- Constants -----------------------------------------------------------------

const CHECK_ICONS: Record<SubmitCheckStatus, { icon: typeof IconCircleCheckFilled; className: string }> = {
  pass: { icon: IconCircleCheckFilled, className: "text-composer-positive" },
  fail: { icon: IconCircleXFilled, className: "text-composer-negative" },
  note: { icon: IconInfoCircleFilled, className: "text-(--muted)" },
};

const TTML_PROBLEMS: Record<UnisonTtmlProblem, { title: string; detail: string }> = {
  "line-breaks": { title: "has line breaks between words", detail: "Unison takes TTML on one line only." },
  "padded-words": {
    title: "has spaces inside word timing",
    detail: "Unison takes the space after a word, not inside it.",
  },
  "zero-length-words": { title: "has words with no length", detail: "Give each word its own start and end time." },
};

const SONG_DETAILS_HINT = "Add it in Song details below.";

// -- Copy ----------------------------------------------------------------------

function checkCopy(check: SubmitCheck, props: CheckListProps): CheckCopy {
  switch (check.id) {
    case "video":
      if (check.status === "pass") {
        return {
          title: "Matched to the YouTube video",
          detail: `${check.videoId} ・ ${formatTime(check.durationSeconds, 0)}`,
        };
      }
      if (check.problem === "no-video") {
        return { title: "No YouTube video chosen", detail: "Unison matches lyrics to a video. Choose it under Video." };
      }
      if (check.problem === "no-duration") return { title: "Song length unknown", detail: "Load the song's audio." };
      return { title: "Song length out of range", detail: "Unison takes songs up to 1 hour long." };
    case "song":
      if (check.status === "pass") return { title: "Title and artist filled in" };
      return { title: check.problem === "no-title" ? "No song title" : "No artist", detail: SONG_DETAILS_HINT };
    case "synced":
      return check.status === "pass"
        ? { title: `All ${pluralize(check.lineCount, "line")} synced` }
        : {
            title: `${check.syncedLineCount} of ${pluralize(check.lineCount, "line")} synced`,
            detail: "Sync every line.",
          };
    case "alignment":
      if (check.status === "fail") {
        return {
          title: UNREVIEWED_TITLE,
          detail: UNREVIEWED_REASON,
          action: { label: "Review in Timeline", run: props.reviewInTimeline },
        };
      }
      return {
        title:
          props.alignmentTier === "mostly-untouched" ? "Most lines keep Auto-align timing" : "Timing checked by you",
      };
    case "ttml": {
      if (check.status === "pass") return { title: "TTML is valid for Unison" };
      const problem = TTML_PROBLEMS[check.problem];
      return {
        title: `${check.edited ? "Edited TTML" : "TTML"} ${problem.title}`,
        detail: problem.detail,
        action: check.edited ? { label: "Regenerate", run: props.regenerate } : undefined,
      };
    }
    case "isrc":
      return check.status === "pass"
        ? { title: "ISRC", detail: props.isrc?.trim() }
        : { title: "No ISRC (optional, helps matching)" };
  }
}

// -- Components ----------------------------------------------------------------

const CheckRow: React.FC<{ status: SubmitCheckStatus; copy: CheckCopy }> = ({ status, copy }) => {
  const { icon: CheckIcon, className } = CHECK_ICONS[status];
  const failed = status === "fail";
  return (
    <li className="flex gap-2.5">
      <CheckIcon aria-hidden="true" className={cn("mt-px size-4 shrink-0", className)} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span
          className={cn(
            "text-[13px] leading-[18px] text-pretty",
            failed ? "font-semibold text-composer-error-text" : "text-composer-text",
          )}
        >
          <span className="sr-only">{failed ? "Failed: " : "Note: "}</span>
          {copy.title}
        </span>
        {copy.detail && (
          <span
            className={cn(
              "text-xs leading-[18px] text-pretty select-text cursor-text",
              failed ? "text-composer-error-text/85" : "text-(--muted)",
            )}
          >
            {copy.detail}
          </span>
        )}
        {copy.action && (
          <span>
            <Button size="sm" variant="secondary" onClick={copy.action.run} className="mt-1">
              {copy.action.label}
            </Button>
          </span>
        )}
      </div>
    </li>
  );
};

const PassedChecks: React.FC<{ copies: readonly CheckCopy[] }> = ({ copies }) => (
  <details className="group/passed">
    <summary className="flex w-fit items-center gap-2.5 text-[13px] text-(--label) cursor-pointer list-none [&::-webkit-details-marker]:hidden hover:text-composer-text">
      <IconCircleCheckFilled aria-hidden="true" className="size-4 shrink-0 text-composer-positive" />
      {pluralize(copies.length, "check")} passed
      <IconChevronDown
        aria-hidden="true"
        className="size-3.5 text-(--muted) transition-[rotate] group-open/passed:rotate-180 motion-reduce:transition-none"
      />
    </summary>
    <ul className="flex flex-col gap-2 mt-2 pl-6.5">
      {copies.map((copy) => (
        <li key={copy.title} className="flex flex-col text-[13px] leading-[18px] text-(--label)">
          {copy.title}
          {copy.detail && <span className="text-xs text-(--muted) select-text cursor-text">{copy.detail}</span>}
        </li>
      ))}
    </ul>
  </details>
);

const CheckList: React.FC<CheckListProps> = (props) => {
  const rows = props.checks.map((check) => ({ check, copy: checkCopy(check, props) }));
  const needsYou = rows.filter(({ check }) => check.status !== "pass");
  const passed = rows.flatMap(({ check, copy }) => (check.status === "pass" ? [copy] : []));
  return (
    <div className="flex flex-col gap-2">
      {needsYou.length > 0 && (
        <ul aria-label="Checks that need you" className="flex flex-col gap-2">
          {needsYou.map(({ check, copy }) => (
            <CheckRow key={check.id} status={check.status} copy={copy} />
          ))}
        </ul>
      )}
      {passed.length > 0 && <PassedChecks copies={passed} />}
    </div>
  );
};

// -- Exports -------------------------------------------------------------------

export { CheckList };
