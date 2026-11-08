import { type RevisionChangeCounts, revisionChangeCounts, revisionDiffLines } from "@/domain/unison/revision-changes";
import type { RevisionPreview } from "@/lib/unison/revision-types";
import { Button } from "@/ui/button";
import { DiffList } from "@/ui/unison/diff-list";
import { pluralize } from "@/utils/pluralize";
import { unisonFailureReason } from "@/utils/unison-toast";
import { PanelSection } from "@/views/export/unison/panel-section";
import { SkeletonBar } from "@/views/unison/view-states";
import { IconGitCompare } from "@tabler/icons-react";
import { useMemo } from "react";

// -- Interfaces ----------------------------------------------------------------

interface ChangesSectionProps {
  preview: RevisionPreview | undefined;
  upToDate: boolean;
  error: unknown;
  reasonId: string;
  onRetry: () => void;
}

// -- Constants -----------------------------------------------------------------

const NO_CHANGES_REASON = "Nothing to update. This is already the live version.";

// -- Helpers -------------------------------------------------------------------

function countsLabel({ lines, wordsRetimed, details }: RevisionChangeCounts): string {
  const parts = [
    lines > 0 && pluralize(lines, "line"),
    wordsRetimed > 0 && `${pluralize(wordsRetimed, "word")} retimed`,
    details > 0 && pluralize(details, "detail"),
  ];
  return parts.filter(Boolean).join(" ・ ");
}

// -- Components ----------------------------------------------------------------

const ChangesMeta: React.FC<{ label: string }> = ({ label }) => (
  <span className="flex items-center gap-1.5 text-xs text-(--muted) tabular-nums">
    <IconGitCompare aria-hidden="true" className="size-3.5" />
    {label}
  </span>
);

const ChangesBody: React.FC<ChangesSectionProps> = ({ preview, upToDate, error, reasonId, onRetry }) => {
  const lines = useMemo(() => (preview ? revisionDiffLines(preview.diff.rows) : []), [preview]);
  if (upToDate || preview?.noChanges) {
    return (
      <p id={reasonId} className="text-[13px] leading-5 text-(--label)">
        {NO_CHANGES_REASON}
      </p>
    );
  }
  if (error && !preview) {
    return (
      <div role="alert" className="flex items-center justify-between gap-3">
        <p className="text-[13px] leading-5 text-(--label) text-pretty select-text cursor-text">
          {unisonFailureReason(error)}
        </p>
        <Button size="sm" variant="secondary" onClick={onRetry} className="shrink-0">
          Retry
        </Button>
      </div>
    );
  }
  if (!preview) {
    return (
      <div aria-hidden="true" className="flex flex-col gap-2 py-1 animate-pulse motion-reduce:animate-none">
        <SkeletonBar className="w-3/4" />
        <SkeletonBar className="w-1/2" />
      </div>
    );
  }
  return <DiffList lines={lines} className="max-h-48" />;
};

const ChangesSection: React.FC<ChangesSectionProps> = (props) => {
  const { preview } = props;
  const label = preview && !preview.noChanges ? countsLabel(revisionChangeCounts(preview.diff.rows)) : "";
  return (
    <PanelSection title="Changes" meta={label ? <ChangesMeta label={label} /> : undefined}>
      <div aria-busy={!preview && !props.upToDate && !props.error}>
        <ChangesBody {...props} />
      </div>
    </PanelSection>
  );
};

// -- Exports -------------------------------------------------------------------

export { ChangesSection };
