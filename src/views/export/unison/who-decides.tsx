import type { SuggestionDecider } from "@/lib/unison/api-types";
import { whoDecidesText } from "@/utils/unison-suggest-copy";

// -- Components ----------------------------------------------------------------

const WhoDecides: React.FC<{
  decider: SuggestionDecider | undefined;
  owner: string | null;
  ownerDecisionSec: number | null;
}> = ({ decider, owner, ownerDecisionSec }) => {
  const text = whoDecidesText(decider, owner, ownerDecisionSec);
  return text ? <p className="text-xs leading-[18px] text-(--muted) text-pretty">{text}</p> : null;
};

// -- Exports -------------------------------------------------------------------

export { WhoDecides };
