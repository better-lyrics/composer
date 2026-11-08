import { toast } from "sonner";
import { isUnisonNotFound, isUnisonSessionEnded, UnisonError } from "@/lib/unison/client";
import { useProjectStore } from "@/stores/project";
import { settingEntry } from "@/stores/settings-catalog";
import { skippedLinesMessage } from "@/utils/lyrics-parsers/shared";
import { pluralize } from "@/utils/pluralize";

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
  if (isUnisonSessionEnded(error)) return SESSION_ENDED_REASON;
  if (isUnisonNotFound(error)) return GONE_REASON;
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

function showWantedShelfHiddenToast(undo: () => void): void {
  toast(`${settingEntry("unisonWantedShelf").label} hidden`, { action: { label: "Undo", onClick: undo } });
}

function showProjectsLinkedToast(count: number, undo: () => void): void {
  toast.success(`Linked ${pluralize(count, "project")} to Unison`, { action: { label: "Undo", onClick: undo } });
}

function showLyricsAddedToProjectsToast(added: number, failed: number, undo: () => void): void {
  const description = failed > 0 ? `Could not add ${pluralize(failed, "other lyric")}.` : undefined;
  toast.success(`Added ${pluralize(added, "project")} from Unison`, {
    description,
    action: { label: "Undo", onClick: undo },
  });
}

function showLinkFailedToast(count: number): void {
  toast.error(`Could not link ${pluralize(count, "project")}`, { description: "Saving failed. Try again." });
}

function showEditWithdrawnToast(): void {
  toast("Edit withdrawn. Listeners keep the current version.");
}

function showSubmittedToast(unlinkedVideoIds: readonly string[]): void {
  const description =
    unlinkedVideoIds.length === 0
      ? undefined
      : `Could not link ${unlinkedVideoIds.length === 1 ? "this video" : "these videos"}: ${unlinkedVideoIds.join(", ")}`;
  toast.success("Submitted to Unison. It's live now.", { description });
}

function showUpdateSentToast(goesLive: boolean): void {
  toast.success(goesLive ? "Update is live on Unison." : "Edit sent to the council.");
}

function showRevisionLoadedToast(revNo: number, skippedLines: number): void {
  toast.success(`Loaded revision ${revNo}`, {
    description: skippedLines > 0 ? skippedLinesMessage(skippedLines) : undefined,
    action: { label: "Undo", onClick: () => useProjectStore.getState().undo() },
  });
}

function showRevisionRestoredToast(revNo: number, goesLive: boolean): void {
  toast.success(goesLive ? `Revision ${revNo} is live again.` : `Revision ${revNo} sent to the council.`);
}

function showUnisonFailureToast(title: string, error: unknown): void {
  toast.error(title, { description: unisonFailureReason(error) });
}

// -- Exports ------------------------------------------------------------------

export {
  showConnectedToast,
  showDisconnectedToast,
  showEditWithdrawnToast,
  showLinkFailedToast,
  showLyricsAddedToProjectsToast,
  showProjectsLinkedToast,
  showRemovedFromUnisonToast,
  showRevisionLoadedToast,
  showRevisionRestoredToast,
  showSubmittedToast,
  showUnisonFailureToast,
  showUpdateSentToast,
  showWantedShelfHiddenToast,
  unisonFailureReason,
};
