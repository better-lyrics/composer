import { lyricOwnerName } from "@/domain/unison/ownership";
import { useLinkedLyric } from "@/hooks/unison/useLinkedLyric";
import { Button } from "@/ui/button";
import { ConnectPopover } from "@/ui/unison/connect-popover";
import {
  CONNECT_TO_SUGGEST_LABEL,
  CONNECT_TO_SUGGEST_REASON,
  CONNECT_TO_SUGGEST_TEXT,
  suggestTitle,
} from "@/utils/unison-suggest-copy";
import {
  UNISON_CARD_HEADING_STYLES,
  UNISON_CARD_STYLES,
  UNISON_CARD_TEXT_STYLES,
} from "@/views/export/unison/unison-card-styles";
import { useId } from "react";

// -- Interfaces ----------------------------------------------------------------

interface SignedOutCopy {
  heading: string;
  text: string;
  buttonLabel: string;
  reason: string;
}

// -- Constants -----------------------------------------------------------------

const SUBMIT_COPY: SignedOutCopy = {
  heading: "Share on Unison",
  text: "Better Lyrics listeners see your sync and vote on it.",
  buttonLabel: "Connect to submit",
  reason: "Connect to submit these lyrics to Unison.",
};

// -- Components ----------------------------------------------------------------

const SignedOutCard: React.FC<{ copy?: SignedOutCopy }> = ({ copy = SUBMIT_COPY }) => {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className={UNISON_CARD_STYLES}>
      <h3 id={headingId} className={UNISON_CARD_HEADING_STYLES}>
        {copy.heading}
      </h3>
      <p className={UNISON_CARD_TEXT_STYLES}>{copy.text}</p>
      <ConnectPopover
        placement="left-start"
        reason={copy.reason}
        trigger={
          <Button size="lg" variant="secondary" className="w-full">
            {copy.buttonLabel}
          </Button>
        }
      />
    </section>
  );
};

const SignedOutSuggestCard: React.FC<{ lyricId: string }> = ({ lyricId }) => {
  const linked = useLinkedLyric(lyricId);
  const owner = linked.kind === "found" ? lyricOwnerName(linked.lyric) : null;
  return (
    <SignedOutCard
      copy={{
        heading: suggestTitle(owner),
        text: CONNECT_TO_SUGGEST_TEXT,
        buttonLabel: CONNECT_TO_SUGGEST_LABEL,
        reason: CONNECT_TO_SUGGEST_REASON,
      }}
    />
  );
};

// -- Exports -------------------------------------------------------------------

export { SignedOutCard, SignedOutSuggestCard };
