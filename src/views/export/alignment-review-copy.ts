import { pluralize } from "@/utils/pluralize";

// -- Constants ----------------------------------------------------------------

const UNREVIEWED_TITLE = "Don't upload this to Unison";

const UNREVIEWED_REASON =
  "You haven't checked a single line since Auto-align. Bad syncs get reported and downvoted on Unison. Keep uploading them and your account WILL be banned.";

const UNREVIEWED_INSTRUCTION = "Fix every line in the Timeline first.";

const MOSTLY_UNREVIEWED_REST =
  "still have the timing Auto-align gave them. Check them before you upload to Unison. Bad syncs get reported and downvoted.";

// -- Functions ----------------------------------------------------------------

function untouchedShare(untouchedCount: number, timedCount: number): string {
  return `${untouchedCount} of ${pluralize(timedCount, "line")}`;
}

// -- Exports ------------------------------------------------------------------

export { MOSTLY_UNREVIEWED_REST, UNREVIEWED_INSTRUCTION, UNREVIEWED_REASON, UNREVIEWED_TITLE, untouchedShare };
