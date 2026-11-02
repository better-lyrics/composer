import { UnisonError } from "@/lib/unison/client";
import { toast } from "sonner";

// -- Constants ----------------------------------------------------------------

const UNREACHABLE_REASON = "Could not reach Unison. Check your connection and try again.";
const SESSION_ENDED_REASON = "Your Unison session ended. Connect again, then retry.";
const GONE_REASON = "It is no longer on Unison.";
const GENERIC_REASON = "Unison could not finish this. Try again in a moment.";

// -- Helpers ------------------------------------------------------------------

function unisonFailureReason(error: unknown): string {
  if (!(error instanceof UnisonError)) return GENERIC_REASON;
  if (error.hint) return error.hint;
  if (error.code === "NETWORK") return UNREACHABLE_REASON;
  if (error.code === "AUTH_REQUIRED" || error.status === 401) return SESSION_ENDED_REASON;
  if (error.status === 404) return GONE_REASON;
  return GENERIC_REASON;
}

// -- Toasts -------------------------------------------------------------------

function showConnectedToast(displayName: string): void {
  toast.success(`Connected as ${displayName}`);
}

function showDisconnectedToast(): void {
  toast("Disconnected from Unison");
}

function showRemovedFromUnisonToast(): void {
  toast("Removed from Unison");
}

function showEditWithdrawnToast(): void {
  toast("Edit withdrawn. Listeners keep the current version.");
}

function showUnisonFailureToast(title: string, error: unknown): void {
  toast.error(title, { description: unisonFailureReason(error) });
}

// -- Exports ------------------------------------------------------------------

export {
  showConnectedToast,
  showDisconnectedToast,
  showEditWithdrawnToast,
  showRemovedFromUnisonToast,
  showUnisonFailureToast,
};
