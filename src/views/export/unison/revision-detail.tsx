import { isSealed } from "@/domain/unison/lyric-status";
import { type MakeLiveRefusal, makeLiveRefusal, revisionDiffBase } from "@/domain/unison/revision-history";
import type { UnisonLyric } from "@/lib/unison/api-types";
import type { RevisionSummary } from "@/lib/unison/revision-types";
import { Button } from "@/ui/button";
import { RevisionDiffSection } from "@/views/export/unison/revision-diff";
import { RevisionStatusLabel, revisionDate } from "@/views/export/unison/revision-list";
import type { RevisionActions } from "@/views/export/unison/use-revision-actions";
import { useId } from "react";

// -- Interfaces ----------------------------------------------------------------

interface RevisionDetailProps {
  lyric: UnisonLyric;
  revision: RevisionSummary;
  revisions: readonly RevisionSummary[];
  canEdit: boolean;
  now: number;
  actions: RevisionActions;
}

// -- Constants -----------------------------------------------------------------

const REFUSAL_REASONS: Record<MakeLiveRefusal, string> = {
  live: "Listeners see this revision now.",
  pending: "This revision waits for the council.",
  "never-live": "Only a revision that was live can come back.",
  "not-owner": "Only the submitter can change the live version.",
};

// -- Components ----------------------------------------------------------------

const CouncilNote: React.FC<{ note: string }> = ({ note }) => (
  <div className="flex flex-col gap-1 p-3 rounded-[10px] bg-composer-error/10 shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--color-composer-error)_24%,transparent)]">
    <h4 className="text-xs font-medium text-composer-error-text">Council's note</h4>
    <p className="text-[13px] leading-5 text-composer-text text-pretty select-text cursor-text">{note}</p>
  </div>
);

const RevisionDetail: React.FC<RevisionDetailProps> = ({ lyric, revision, revisions, canEdit, now, actions }) => {
  const reasonId = useId();
  const refusal = makeLiveRefusal(revision, canEdit);
  const busy = actions.busy !== null;
  return (
    <div className="flex flex-col gap-4 min-h-0 min-w-0">
      <div className="flex items-center gap-3 h-6">
        <h3 className="text-sm font-semibold tabular-nums">Revision {revision.revNo}</h3>
        <RevisionStatusLabel revision={revision} />
        <span className="ml-auto text-xs text-(--muted) select-text">{revisionDate(revision, now)}</span>
      </div>
      {revision.status === "rejected" && revision.reviewNote && <CouncilNote note={revision.reviewNote} />}
      <RevisionDiffSection
        lyricId={lyric.id}
        revId={revision.id}
        againstRevId={revisionDiffBase(revision, revisions)}
        isLive={revision.status === "live"}
      />
      <div className="flex items-center gap-3 pt-1">
        <Button size="lg" variant="secondary" disabled={busy} onClick={() => void actions.loadIntoProject(revision)}>
          {actions.busy === "load" ? "Loading" : "Load into project"}
        </Button>
        {refusal && (
          <p id={reasonId} className="ml-auto text-xs text-(--muted) text-right text-pretty">
            {REFUSAL_REASONS[refusal]}
          </p>
        )}
        <Button
          size="lg"
          variant="primary"
          disabled={busy || refusal !== null}
          aria-describedby={refusal ? reasonId : undefined}
          onClick={() => void actions.makeLive(revision)}
          className={refusal ? undefined : "ml-auto"}
        >
          {isSealed(lyric) ? "Send for review" : "Make this live"}
        </Button>
      </div>
    </div>
  );
};

// -- Exports -------------------------------------------------------------------

export { RevisionDetail };
