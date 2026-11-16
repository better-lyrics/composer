import type { SuggestionDecider } from "@/lib/unison/api-types";
import { formatRelativeTimeInline } from "@/utils/format-relative-time";
import { pluralize } from "@/utils/pluralize";

// -- Constants -----------------------------------------------------------------

const DAY_SEC = 86_400;
const SEND_SUGGESTION_LABEL = "Send suggestion";
const WITHDRAW_SUGGESTION_LABEL = "Withdraw suggestion";
const NOTE_PLACEHOLDER = "For example: line 3 had a typo";
const NEEDS_OWN_LYRIC = "You need one live lyric of your own before you can suggest edits.";
const ONE_ALREADY_WAITING = "A change to this lyric is already waiting. Try again once it is decided.";
const NOTHING_TO_SEND = "Nothing to send yet. Your project matches the live version.";
const WAITING_TITLE = "Your suggestion is waiting";
const YOUR_NOTE_LABEL = "Your note";
const COUNCIL_DECIDES = "The council decides this one.";
const CONNECT_TO_SUGGEST_TEXT = "Connect your Better Lyrics account to send your fix as a suggestion.";
const CONNECT_TO_SUGGEST_LABEL = "Connect to suggest";
const CONNECT_TO_SUGGEST_REASON = "Connect to send your fix as a suggestion.";

// -- Copy ----------------------------------------------------------------------

function ownerLyric(owner: string | null): string {
  return owner ? `${owner}'s lyric` : "this lyric";
}

function suggestTitle(owner: string | null): string {
  return `Suggest an edit to ${ownerLyric(owner)}`;
}

function liveLine(revNo: number): string {
  return `Rev ${revNo} is live on Unison.`;
}

function withdrawnLine(liveRevNo: number): string {
  return `You withdrew your suggestion. Rev ${liveRevNo} stays live.`;
}

function noteLabel(owner: string | null, decider: SuggestionDecider | undefined): string {
  if (decider === "council") return "Note for the council (optional)";
  return owner ? `Note for ${owner} (optional)` : "Note (optional)";
}

function ownerWindowText(owner: string, ownerDecisionSec: number): string {
  return `${owner} has ${pluralize(Math.ceil(ownerDecisionSec / DAY_SEC), "day")} to decide.`;
}

function whoDecidesText(
  decider: SuggestionDecider | undefined,
  owner: string | null,
  ownerDecisionSec: number | null,
): string | null {
  if (decider === "council") return COUNCIL_DECIDES;
  if (decider !== "owner" || !owner || ownerDecisionSec === null) return null;
  return `${ownerWindowText(owner, ownerDecisionSec)} After that, the council can too.`;
}

function sentDetail(
  decider: SuggestionDecider | undefined,
  owner: string | null,
  ownerDecisionSec: number | null,
): string | undefined {
  if (decider === "council") return COUNCIL_DECIDES;
  if (decider !== "owner" || !owner || ownerDecisionSec === null) return undefined;
  return ownerWindowText(owner, ownerDecisionSec);
}

function waitingMeta(revNo: number, createdAtSec: number, nowMs: number): string {
  return `Rev ${revNo}, sent ${formatRelativeTimeInline(createdAtSec * 1000, nowMs)}`;
}

function decidedByName(decidedBy: SuggestionDecider, owner: string | null): string {
  return decidedBy === "owner" && owner ? owner : "The council";
}

function approvedTitle(decidedBy: SuggestionDecider, owner: string | null): string {
  return `${decidedByName(decidedBy, owner)} approved your suggestion`;
}

function approvedLine(revNo: number): string {
  return `Rev ${revNo} is live, with your name on the song page.`;
}

function rejectedTitle(decidedBy: SuggestionDecider, owner: string | null): string {
  return `${decidedByName(decidedBy, owner)} rejected your suggestion`;
}

function staysLiveLine(liveRevNo: number): string {
  return `Rev ${liveRevNo} stays live.`;
}

function supersededLine(owner: string): string {
  return `${owner} saved a new version, so your suggestion closed.`;
}

function rejectNoteLabel(decidedBy: SuggestionDecider, owner: string | null): string {
  return decidedBy === "owner" && owner ? `Note from ${owner}` : "Note from the council";
}

// -- Exports -------------------------------------------------------------------

export {
  approvedLine,
  approvedTitle,
  CONNECT_TO_SUGGEST_LABEL,
  CONNECT_TO_SUGGEST_REASON,
  CONNECT_TO_SUGGEST_TEXT,
  liveLine,
  NEEDS_OWN_LYRIC,
  NOTE_PLACEHOLDER,
  NOTHING_TO_SEND,
  noteLabel,
  ONE_ALREADY_WAITING,
  ownerLyric,
  rejectedTitle,
  rejectNoteLabel,
  SEND_SUGGESTION_LABEL,
  sentDetail,
  staysLiveLine,
  suggestTitle,
  supersededLine,
  WAITING_TITLE,
  WITHDRAW_SUGGESTION_LABEL,
  waitingMeta,
  whoDecidesText,
  withdrawnLine,
  YOUR_NOTE_LABEL,
};
