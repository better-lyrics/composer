import { UNISON_VARIANT_CAP } from "@/domain/unison/submit-checks";
import { isUnisonSessionEnded, UnisonError } from "@/lib/unison/client";
import { unisonFailureReason } from "@/utils/unison-toast";

// -- Types ---------------------------------------------------------------------

type SubmitFailure = { kind: "session-ended" } | { kind: "message"; text: string };

// -- Constants -----------------------------------------------------------------

const SUBMIT_ERROR_COPY: Record<string, string> = {
  VARIANT_CAP_REACHED: `You already have ${UNISON_VARIANT_CAP} versions of this song. Update one instead.`,
  TTML_FORMATTED: "Unison takes TTML without line breaks or padding between words. Regenerate, then try again.",
  TTML_MALFORMED: "Unison could not read this TTML. Regenerate, then try again.",
  TTML_ZERO_DURATION_WORDS: "Most words start and end at the same time. Give each word its own timing, then try again.",
  RATE_LIMITED: "Too many sends in a row. Wait a minute, then try again.",
  NO_CHANGES: "Nothing changed since the live version.",
};

// -- Functions -----------------------------------------------------------------

function submitFailure(error: unknown): SubmitFailure {
  if (isUnisonSessionEnded(error)) return { kind: "session-ended" };
  if (!(error instanceof UnisonError)) return { kind: "message", text: unisonFailureReason(error) };
  // Unison's own hint names the daily edit limit, which a generic line would hide.
  if (error.code === "RATE_LIMITED" && error.hint) return { kind: "message", text: error.hint };
  return { kind: "message", text: SUBMIT_ERROR_COPY[error.code] ?? unisonFailureReason(error) };
}

// -- Exports -------------------------------------------------------------------

export { submitFailure };
