import { type HistoryStatus, historyStatus, revisionSummaryLine } from "@/domain/unison/revision-history";
import type { RevisionSummary } from "@/lib/unison/revision-types";
import { StatusChip } from "@/ui/status-chip";
import { cn } from "@/utils/cn";
import { formatRelativeTime } from "@/utils/format-relative-time";
import { SkeletonBar, SkeletonRows } from "@/views/unison/view-states";
import { type Icon, IconCircleCheck, IconCircleX, IconHourglassHigh } from "@tabler/icons-react";
import { useRef } from "react";

// -- Interfaces ----------------------------------------------------------------

interface RevisionListProps {
  revisions: readonly RevisionSummary[];
  selectedId: number;
  now: number;
  onSelect: (revision: RevisionSummary) => void;
}

// -- Constants -----------------------------------------------------------------

const STATUS_CHIPS: Partial<Record<HistoryStatus, { tone: "positive" | "warning" | "error"; icon: Icon }>> = {
  live: { tone: "positive", icon: IconCircleCheck },
  pending: { tone: "warning", icon: IconHourglassHigh },
  declined: { tone: "error", icon: IconCircleX },
};

const STATUS_LABELS: Record<HistoryStatus, string> = {
  live: "Live",
  pending: "In review",
  declined: "Declined",
  earlier: "Earlier",
  withdrawn: "Withdrawn",
  replaced: "Replaced before review",
};

const NAVIGATION_KEYS = new Set(["ArrowDown", "ArrowUp", "Home", "End"]);

// -- Helpers -------------------------------------------------------------------

function revisionDate(revision: RevisionSummary, now: number): string {
  return formatRelativeTime(revision.createdAt * 1000, now);
}

function nextIndex(key: string, current: number, count: number): number {
  if (key === "Home") return 0;
  if (key === "End") return count - 1;
  return Math.min(count - 1, Math.max(0, current + (key === "ArrowDown" ? 1 : -1)));
}

// -- Components ----------------------------------------------------------------

const RevisionStatusLabel: React.FC<{ revision: RevisionSummary }> = ({ revision }) => {
  const status = historyStatus(revision.status);
  const chip = STATUS_CHIPS[status];
  if (!chip) return <span className="min-w-0 truncate text-xs text-(--muted)">{STATUS_LABELS[status]}</span>;
  return (
    <StatusChip tone={chip.tone} icon={chip.icon}>
      {STATUS_LABELS[status]}
    </StatusChip>
  );
};

const RevisionListSkeleton: React.FC = () => (
  <SkeletonRows count={5} rowClassName="flex flex-col gap-2 px-2.5 py-3">
    <SkeletonBar className="w-3/5" />
    <SkeletonBar className="w-4/5" />
  </SkeletonRows>
);

const RevisionList: React.FC<RevisionListProps> = ({ revisions, selectedId, now, onSelect }) => {
  const listRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!NAVIGATION_KEYS.has(event.key)) return;
    event.preventDefault();
    const current = revisions.findIndex((revision) => revision.id === selectedId);
    const index = nextIndex(event.key, current, revisions.length);
    onSelect(revisions[index]);
    listRef.current?.querySelectorAll<HTMLElement>('[role="option"]')[index]?.focus();
  };

  return (
    // react-doctor-disable-next-line react-doctor/prefer-tag-over-role
    <div
      ref={listRef}
      role="listbox"
      aria-label="Revisions"
      onKeyDown={handleKeyDown}
      className="flex flex-col gap-1 -ml-2 overflow-auto overscroll-contain"
    >
      {revisions.map((revision) => {
        const selected = revision.id === selectedId;
        return (
          <button
            key={revision.id}
            type="button"
            role="option"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onSelect(revision)}
            className={cn(
              "flex w-full flex-col gap-1 px-2.5 py-2 rounded-[10px] text-left cursor-pointer transition-colors duration-100 outline-none focus-visible:outline-2 focus-visible:outline-composer-accent focus-visible:-outline-offset-2",
              selected ? "bg-composer-accent/12" : "hover:bg-(--layer-1)",
            )}
          >
            <span className="flex items-center gap-2">
              <span className="shrink-0 text-[13px] font-medium tabular-nums whitespace-nowrap">
                Revision {revision.revNo}
              </span>
              <RevisionStatusLabel revision={revision} />
              <span className="ml-auto shrink-0 text-xs text-(--muted) whitespace-nowrap">
                {revisionDate(revision, now)}
              </span>
            </span>
            <span className="text-xs text-(--muted) truncate">{revisionSummaryLine(revision)}</span>
          </button>
        );
      })}
    </div>
  );
};

// -- Exports -------------------------------------------------------------------

export { RevisionList, RevisionListSkeleton, RevisionStatusLabel, revisionDate };
