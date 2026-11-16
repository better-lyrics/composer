import { lyricOwnerName } from "@/domain/unison/ownership";
import type { SuggestionOutcome } from "@/domain/unison/suggestion-outcome";
import type { RevisionSuggestion, UnisonLyric } from "@/lib/unison/api-types";
import { Button } from "@/ui/button";
import { cn } from "@/utils/cn";
import {
  approvedLine,
  approvedTitle,
  rejectedTitle,
  rejectNoteLabel,
  staysLiveLine,
  WAITING_TITLE,
  waitingMeta,
  WITHDRAW_SUGGESTION_LABEL,
  YOUR_NOTE_LABEL,
} from "@/utils/unison-suggest-copy";
import {
  UNISON_CARD_HEADING_STYLES,
  UNISON_CARD_STYLES,
  UNISON_CARD_TEXT_STYLES,
} from "@/views/export/unison/unison-card-styles";
import { useOnUnisonActions } from "@/views/export/unison/use-on-unison-actions";
import { WhoDecides } from "@/views/export/unison/who-decides";
import { IconArrowBackUp } from "@tabler/icons-react";
import { useId } from "react";

// -- Interfaces ----------------------------------------------------------------

interface WaitingCardProps {
  lyric: UnisonLyric;
  suggestion: RevisionSuggestion;
  keyId: string;
}

type DecidedOutcome = Extract<SuggestionOutcome, { kind: "approved" | "rejected" }>;

// -- Components ----------------------------------------------------------------

const QuotedNote: React.FC<{ label: string; text: string }> = ({ label, text }) => (
  <div className="flex flex-col gap-1">
    <p className="text-xs font-medium text-(--muted)">{label}</p>
    <p className={cn(UNISON_CARD_TEXT_STYLES, "select-text cursor-text")}>{text}</p>
  </div>
);

const SuggestionWaitingCard: React.FC<WaitingCardProps> = ({ lyric, suggestion, keyId }) => {
  const actions = useOnUnisonActions(lyric, keyId);
  const headingId = useId();
  const ownerSecLeft = suggestion.councilDecidesAt === null ? 0 : suggestion.councilDecidesAt - Date.now() / 1000;
  return (
    <section aria-labelledby={headingId} aria-busy={actions.busy} className={UNISON_CARD_STYLES}>
      <h3 id={headingId} className={UNISON_CARD_HEADING_STYLES}>
        {WAITING_TITLE}
      </h3>
      <p className={UNISON_CARD_TEXT_STYLES}>{waitingMeta(suggestion.revNo, suggestion.createdAt, Date.now())}</p>
      {suggestion.note && <QuotedNote label={YOUR_NOTE_LABEL} text={suggestion.note} />}
      <WhoDecides
        decider={suggestion.decider}
        owner={lyricOwnerName(lyric)}
        ownerDecisionSec={ownerSecLeft > 0 ? ownerSecLeft : null}
      />
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="secondary"
          hasIcon
          disabled={actions.busy}
          onClick={() => void actions.withdrawSuggestion()}
        >
          <IconArrowBackUp aria-hidden="true" className="size-4" />
          {WITHDRAW_SUGGESTION_LABEL}
        </Button>
      </div>
    </section>
  );
};

const SuggestionOutcomeCard: React.FC<{ outcome: DecidedOutcome; lyric: UnisonLyric }> = ({ outcome, lyric }) => {
  const headingId = useId();
  const owner = lyricOwnerName(lyric);
  const approved = outcome.kind === "approved";
  return (
    <section aria-labelledby={headingId} className={UNISON_CARD_STYLES}>
      <h3 id={headingId} className={UNISON_CARD_HEADING_STYLES}>
        {approved ? approvedTitle(outcome.decidedBy, owner) : rejectedTitle(outcome.decidedBy, owner)}
      </h3>
      {outcome.kind === "rejected" && outcome.note && (
        <QuotedNote label={rejectNoteLabel(outcome.decidedBy, owner)} text={outcome.note} />
      )}
      <p className={UNISON_CARD_TEXT_STYLES}>
        {approved ? approvedLine(outcome.revNo) : staysLiveLine(lyric.revision.revNo)}
      </p>
    </section>
  );
};

// -- Exports -------------------------------------------------------------------

export { SuggestionOutcomeCard, SuggestionWaitingCard };
