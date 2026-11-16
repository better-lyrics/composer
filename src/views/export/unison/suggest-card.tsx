import { lyricOwnerName } from "@/domain/unison/ownership";
import { type SuggestionOutcome, suggestionOutcome } from "@/domain/unison/suggestion-outcome";
import { useRevisionPreview } from "@/hooks/unison/useRevisionPreview";
import { useRevisions } from "@/hooks/unison/useRevisions";
import type { UnisonLyric } from "@/lib/unison/api-types";
import { UnisonError } from "@/lib/unison/client";
import { INPUT_STYLES } from "@/ui/input-styles";
import { cn } from "@/utils/cn";
import {
  liveLine,
  NEEDS_OWN_LYRIC,
  NOTE_PLACEHOLDER,
  NOTHING_TO_SEND,
  noteLabel,
  ONE_ALREADY_WAITING,
  SEND_SUGGESTION_LABEL,
  suggestTitle,
  supersededLine,
  withdrawnLine,
} from "@/utils/unison-suggest-copy";
import { ChangesSection } from "@/views/export/unison/changes-section";
import { DIVIDED_SECTION_STYLES } from "@/views/export/unison/panel-section";
import {
  ChecksReason,
  FailedServerChecks,
  type SubmitterSession,
  useSender,
  useUpdateBlockers,
} from "@/views/export/unison/submit-card";
import {
  SubmitCardShell,
  type UnisonExportSource,
  useRevisionInput,
  useSubmitChecks,
} from "@/views/export/unison/submit-card-shell";
import { SubmitFooter } from "@/views/export/unison/submit-footer";
import { SuggestionOutcomeCard, SuggestionWaitingCard } from "@/views/export/unison/suggestion-status";
import { UNISON_CARD_TEXT_STYLES } from "@/views/export/unison/unison-card-styles";
import { WhoDecides } from "@/views/export/unison/who-decides";
import { useId, useState } from "react";

// -- Interfaces ----------------------------------------------------------------

interface SuggestCardProps {
  lyric: UnisonLyric;
  session: SubmitterSession;
  sessionEnded: boolean;
  onSessionEnded: () => void;
  source: UnisonExportSource;
}

interface NoteFieldProps {
  label: string;
  value: string;
  maxLength?: number;
  disabled: boolean;
  onChange: (value: string) => void;
}

// -- Helpers -------------------------------------------------------------------

function suggestBlocker(lyric: UnisonLyric, keyId: string, previewError: unknown): string | null {
  if (previewError instanceof UnisonError && previewError.code === "SUGGEST_NEEDS_LYRIC") return NEEDS_OWN_LYRIC;
  const { suggestion, pending } = lyric.revision;
  const othersWaiting = suggestion !== undefined && suggestion.authorKeyId !== keyId;
  return othersWaiting || pending ? ONE_ALREADY_WAITING : null;
}

// -- Components ----------------------------------------------------------------

const NoteField: React.FC<NoteFieldProps> = ({ label, value, maxLength, disabled, onChange }) => {
  const id = useId();
  return (
    <div className={cn("flex flex-col gap-1.5 py-4", DIVIDED_SECTION_STYLES)}>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-[13px] font-semibold text-composer-text">
          {label}
        </label>
        {maxLength !== undefined && (
          <span className="text-xs text-(--muted) tabular-nums">{`${value.length}/${maxLength}`}</span>
        )}
      </div>
      <textarea
        id={id}
        value={value}
        rows={3}
        maxLength={maxLength}
        disabled={disabled}
        placeholder={NOTE_PLACEHOLDER}
        onChange={(event) => onChange(event.target.value)}
        className={cn(INPUT_STYLES, "resize-none leading-5")}
      />
    </div>
  );
};

const SuggestForm: React.FC<SuggestCardProps & { lead?: React.ReactNode }> = (props) => {
  const { lyric, session, sessionEnded, source, lead } = props;
  const owner = lyricOwnerName(lyric);
  const checks = useSubmitChecks("update", source);
  const input = useRevisionInput(source.content);
  const { sender, onError, failureText } = useSender(props);
  const { query, upToDate, settling } = useRevisionPreview(lyric.id, input, onError);
  const preview = upToDate ? undefined : query.data;
  const { ids, failedServerChecks, blocked, blockedReasonId } = useUpdateBlockers(checks.canSubmit, preview, false);
  const [note, setNote] = useState("");
  const blockerId = useId();
  const blocker = suggestBlocker(lyric, session.keyId, query.error);
  const needsLyric = blocker === NEEDS_OWN_LYRIC;
  const ownerDecisionSec = preview?.ownerDecisionSec ?? null;

  return (
    <SubmitCardShell
      mode="update"
      title={suggestTitle(owner)}
      lead={lead ?? <p className={UNISON_CARD_TEXT_STYLES}>{liveLine(lyric.revision.revNo)}</p>}
      busy={sender.pending}
      source={source}
      checks={checks}
    >
      {blocker && (
        <p id={blockerId} role="alert" className={cn(UNISON_CARD_TEXT_STYLES, "pb-4")}>
          {blocker}
        </p>
      )}
      {!needsLyric && (
        <ChangesSection
          preview={preview}
          upToDate={upToDate}
          error={query.error}
          reasonId={ids.changes}
          noChangesText={NOTHING_TO_SEND}
          onRetry={() => void query.refetch()}
        />
      )}
      {!checks.canSubmit && <ChecksReason id={ids.checks} />}
      {failedServerChecks.length > 0 && <FailedServerChecks id={ids.server} checks={failedServerChecks} />}
      <NoteField
        label={noteLabel(owner, preview?.decider)}
        value={note}
        maxLength={preview?.noteMaxLength}
        disabled={sender.pending || blocker !== null}
        onChange={setNote}
      />
      <SubmitFooter
        identity={session}
        outcome={null}
        sessionEnded={sessionEnded}
        failure={failureText}
        label={SEND_SUGGESTION_LABEL}
        pending={sender.pending}
        disabled={blocked || blocker !== null || !preview || preview.noChanges || settling || source.settling}
        blockedReasonId={blocker ? blockerId : blockedReasonId}
        footnote={<WhoDecides decider={preview?.decider} owner={owner} ownerDecisionSec={ownerDecisionSec} />}
        onSend={() =>
          void sender.send({
            kind: "suggest",
            lyricId: lyric.id,
            input,
            note: note.trim() || undefined,
            owner,
            ownerDecisionSec,
          })
        }
      />
    </SubmitCardShell>
  );
};

function outcomeLead(outcome: SuggestionOutcome | null, lyric: UnisonLyric): string | null {
  if (outcome?.kind === "withdrawn") return withdrawnLine(lyric.revision.revNo);
  const owner = lyricOwnerName(lyric);
  return outcome?.kind === "superseded" && owner ? supersededLine(owner) : null;
}

const SuggestCard: React.FC<SuggestCardProps> = (props) => {
  const { lyric, session } = props;
  const history = useRevisions(lyric.id).data;
  const waiting = lyric.revision.suggestion;
  if (waiting && waiting.authorKeyId === session.keyId) {
    return <SuggestionWaitingCard lyric={lyric} suggestion={waiting} keyId={session.keyId} />;
  }
  const outcome = history ? suggestionOutcome(history, session.keyId) : null;
  const leadText = outcomeLead(outcome, lyric);
  return (
    <>
      {(outcome?.kind === "approved" || outcome?.kind === "rejected") && (
        <SuggestionOutcomeCard outcome={outcome} lyric={lyric} />
      )}
      <SuggestForm {...props} lead={leadText ? <p className={UNISON_CARD_TEXT_STYLES}>{leadText}</p> : undefined} />
    </>
  );
};

// -- Exports -------------------------------------------------------------------

export { SuggestCard };
