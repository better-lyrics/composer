import type { UnisonStatus } from "@/domain/unison/lyric-status";
import { useLinkedLyric } from "@/hooks/unison/useLinkedLyric";
import type { UnisonLyric } from "@/lib/unison/api-types";
import { useProjectStore } from "@/stores/project";
import { Button } from "@/ui/button";
import { ConfidenceMeter } from "@/ui/unison/confidence-meter";
import { ScoreLabel } from "@/ui/unison/score-label";
import { DescribedUnisonStatusChip } from "@/ui/unison/unison-status-chip";
import { OnUnisonMenu } from "@/views/export/unison/on-unison-menu";
import {
  UNISON_CARD_HEADING_STYLES,
  UNISON_CARD_STYLES,
  UNISON_CARD_TEXT_STYLES,
} from "@/views/export/unison/unison-card-styles";
import { useOnUnisonActions } from "@/views/export/unison/use-on-unison-actions";
import { InlineError, SkeletonBar } from "@/views/unison/view-states";
import { useId } from "react";

// -- Interfaces ----------------------------------------------------------------

interface OnUnisonCardProps {
  lyricId: string;
  keyId: string;
  videos?: React.ReactNode;
}

interface CardShellProps {
  status?: UnisonStatus;
  trailing?: React.ReactNode;
  busy?: boolean;
  children: React.ReactNode;
}

interface FoundCardProps {
  lyric: UnisonLyric;
  status: UnisonStatus;
  keyId: string;
  videos?: React.ReactNode;
}

// -- Constants -----------------------------------------------------------------

const ACTION_HINTS: Partial<Record<UnisonStatus, string>> = {
  hidden: "Fix the sync and send an update.",
  removed: "No longer on Unison.",
};

// -- Components ----------------------------------------------------------------

const CardShell: React.FC<CardShellProps> = ({ status, trailing, busy, children }) => {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} aria-busy={busy} className={UNISON_CARD_STYLES}>
      <div className="flex items-center gap-2 h-7 -mt-1 -mr-1.5">
        <h3 id={headingId} className={UNISON_CARD_HEADING_STYLES}>
          On Unison
        </h3>
        {status && <DescribedUnisonStatusChip status={status} />}
        {trailing}
      </div>
      {children}
    </section>
  );
};

const ActionHint: React.FC<{ status: UnisonStatus }> = ({ status }) => {
  const hint = ACTION_HINTS[status];
  return hint ? <p className={UNISON_CARD_TEXT_STYLES}>{hint}</p> : null;
};

const CouncilNote: React.FC<{ note: string }> = ({ note }) => (
  <p className={`${UNISON_CARD_TEXT_STYLES} line-clamp-2 select-text cursor-text`}>
    <span className="font-medium text-composer-text">Council's note:</span> {note}
  </p>
);

const LoadingCard: React.FC = () => (
  <CardShell busy>
    <div aria-hidden="true" className="flex items-center justify-between h-5 animate-pulse motion-reduce:animate-none">
      <SkeletonBar className="w-24" />
      <SkeletonBar className="w-28" />
    </div>
  </CardShell>
);

const RemovedCard: React.FC = () => (
  <CardShell status="removed">
    <ActionHint status="removed" />
    <div className="flex gap-2">
      <Button size="sm" variant="secondary" onClick={() => useProjectStore.getState().unlinkUnisonLyric()}>
        Unlink
      </Button>
    </div>
  </CardShell>
);

const FoundCard: React.FC<FoundCardProps> = ({ lyric, status, keyId, videos }) => {
  const actions = useOnUnisonActions(lyric, keyId);
  const councilNote = status === "declined" ? lyric.revision.lastRejected?.reviewNote : null;
  return (
    <CardShell
      status={status}
      busy={actions.busy}
      trailing={<OnUnisonMenu lyric={lyric} disabled={actions.busy} onRemove={actions.remove} />}
    >
      <ActionHint status={status} />
      {councilNote && <CouncilNote note={councilNote} />}
      <div className="flex items-center justify-between gap-3">
        <ScoreLabel score={lyric.score} voteCount={lyric.voteCount} />
        <ConfidenceMeter confidence={lyric.confidence} withLabel />
      </div>
      {videos}
      {status === "pending" && (
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" disabled={actions.busy} onClick={actions.withdraw}>
            Withdraw edit
          </Button>
        </div>
      )}
    </CardShell>
  );
};

const OnUnisonCard: React.FC<OnUnisonCardProps> = ({ lyricId, keyId, videos }) => {
  const linked = useLinkedLyric(lyricId);
  switch (linked.kind) {
    case "loading":
      return <LoadingCard />;
    case "failed":
      return (
        <CardShell>
          <InlineError error={linked.error} onRetry={linked.retry} className="justify-between p-0" />
        </CardShell>
      );
    case "removed":
      return <RemovedCard />;
    case "found":
      return <FoundCard lyric={linked.lyric} status={linked.status} keyId={keyId} videos={videos} />;
  }
};

// -- Exports -------------------------------------------------------------------

export { OnUnisonCard };
