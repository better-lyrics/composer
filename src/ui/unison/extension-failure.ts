import { UnisonError } from "@/lib/unison/client";
import { SignInError, type SignInErrorKind } from "@/lib/unison/sign-in";

// -- Types ---------------------------------------------------------------------

type ExtensionFailure = SignInErrorKind | "unreachable";

// -- Constants -----------------------------------------------------------------

const LOG_PREFIX = "[UnisonConnect]";

const EXTENSION_FAILURE_MESSAGES: Record<ExtensionFailure, string> = {
  cancelled: "You closed the Better Lyrics prompt. Try again, and choose Approve.",
  "not-allowed": "Better Lyrics doesn't allow this site. Use your identity file instead.",
  failed: "Better Lyrics couldn't sign you in. Try again, or use your identity file.",
  unreachable: "Couldn't reach Unison. Check your connection and try again.",
};

// -- Helpers -------------------------------------------------------------------

function extensionFailureOf(error: unknown): ExtensionFailure {
  if (error instanceof SignInError && error.kind === "cancelled") return "cancelled";
  console.error(LOG_PREFIX, "Better Lyrics sign-in failed", error);
  if (error instanceof SignInError) return error.kind;
  return error instanceof UnisonError && error.code === "NETWORK" ? "unreachable" : "failed";
}

// -- Exports -------------------------------------------------------------------

export type { ExtensionFailure };
export { EXTENSION_FAILURE_MESSAGES, extensionFailureOf };
