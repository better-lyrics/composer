import type { KeptOwnTiming, RealignRefusal } from "@/domain/group/shared-placement";
import type { LinkGroup } from "@/domain/group/template";
import { useProjectStore } from "@/stores/project";
import { pluralWord, pluralize } from "@/utils/pluralize";
import { toast } from "sonner";

// -- Constants -----------------------------------------------------------------

const GROUP_TOAST_DURATION_MS = 8000;
const SHARED_SONG_EDGE_TOAST_ID = "shared-song-edge";
const KEPT_OWN_TIMING_REASONS: Record<RealignRefusal, (count: number) => string> = {
  "before-song-start": () => ": the shared timing would start before the song",
  "past-song-end": () => ": the shared timing would run past the end of the song",
  "no-common-timed-line": (count) =>
    `: none of ${pluralWord(count, "its", "their")} synced lines match a line of the synced instance`,
  "no-fully-synced-instance": (count) =>
    `. Sync one instance fully, then share ${pluralWord(count, "it from its banner menu", "them from their banner menus")} in the Timeline.`,
  "would-lose-word-timing": (count) =>
    `: the synced instance is line-synced, so sharing would replace ${pluralWord(count, "its", "their")} word timing`,
};
const MIXED_KEPT_OWN_TIMING_REASON = ". Share them from their banner menus in the Timeline to see why.";

// -- Functions -----------------------------------------------------------------

function showGroupActionToast(message: string, undoFn?: () => void): void {
  toast.success(message, {
    duration: GROUP_TOAST_DURATION_MS,
    action: {
      label: "Undo",
      onClick: undoFn ?? (() => useProjectStore.getState().undo()),
    },
  });
}

function showKeptOwnTimingToast(keptOwnTiming: readonly KeptOwnTiming[]): void {
  const count = keptOwnTiming.length;
  if (count === 0) return;
  const refusals = new Set(keptOwnTiming.map((kept) => kept.refusal));
  const [refusal] = refusals;
  const reason = refusals.size === 1 ? KEPT_OWN_TIMING_REASONS[refusal](count) : MIXED_KEPT_OWN_TIMING_REASON;
  toast(`${pluralize(count, "instance")} kept ${pluralWord(count, "its", "their")} own timing${reason}`, {
    duration: GROUP_TOAST_DURATION_MS,
  });
}

function replacedOwnTimingNote(count: number): string {
  return `The own timing of ${pluralize(count, "instance")} was replaced.`;
}

function showReplacedOwnTimingToast(count: number): void {
  if (count > 0) toast(replacedOwnTimingNote(count), { duration: GROUP_TOAST_DURATION_MS });
}

function showGroupedToast(group: LinkGroup, lineCount: number, filledGaps: number): void {
  const grouped = `Grouped ${pluralize(lineCount, "line")}`;
  toast.success(filledGaps > 0 ? `${grouped} (filled ${pluralize(filledGaps, "gap")})` : grouped, {
    description: group.sharesTiming ? "Sync one instance and the others follow" : undefined,
  });
}

function showPlacementBlockedToast(): void {
  toast.error("Not enough room in the song to place this instance here");
}

function showSharingBlockedToast(name: string, refusal: RealignRefusal): void {
  toast.error(`${name} keeps its own timing${KEPT_OWN_TIMING_REASONS[refusal](1)}`);
}

function showSharedSongEdgeToast(): void {
  toast("Stopped at the song edge: a shared instance would go past it", { id: SHARED_SONG_EDGE_TOAST_ID });
}

// -- Exports -------------------------------------------------------------------

export {
  replacedOwnTimingNote,
  showGroupActionToast,
  showGroupedToast,
  showKeptOwnTimingToast,
  showSharedSongEdgeToast,
  showPlacementBlockedToast,
  showReplacedOwnTimingToast,
  showSharingBlockedToast,
};
