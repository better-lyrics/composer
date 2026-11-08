import { Button } from "@/ui/button";
import { ConnectPopover } from "@/ui/unison/connect-popover";
import {
  UNISON_CARD_HEADING_STYLES,
  UNISON_CARD_STYLES,
  UNISON_CARD_TEXT_STYLES,
} from "@/views/export/unison/unison-card-styles";
import { useId } from "react";

// -- Components ----------------------------------------------------------------

const SignedOutCard: React.FC = () => {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className={UNISON_CARD_STYLES}>
      <h3 id={headingId} className={UNISON_CARD_HEADING_STYLES}>
        Share on Unison
      </h3>
      <p className={UNISON_CARD_TEXT_STYLES}>Better Lyrics listeners see your sync and vote on it.</p>
      <ConnectPopover
        placement="left-start"
        reason="Connect to submit these lyrics to Unison."
        trigger={
          <Button size="lg" variant="secondary" className="w-full">
            Connect to submit
          </Button>
        }
      />
    </section>
  );
};

// -- Exports -------------------------------------------------------------------

export { SignedOutCard };
