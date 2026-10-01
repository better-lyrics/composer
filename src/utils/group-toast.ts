import type { LinkGroup } from "@/domain/group/template";
import { useProjectStore } from "@/stores/project";
import { pluralWord, pluralize } from "@/utils/pluralize";
import { toast } from "sonner";

// -- Constants -----------------------------------------------------------------

const GROUP_TOAST_DURATION_MS = 8000;
const SHARED_SONG_EDGE_TOAST_ID = "shared-song-edge";

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

function offerToShareTiming(newGroups: readonly LinkGroup[]): void {
  const withOwnTiming = newGroups.filter((group) => group.ownTimingInstances?.length);
  const count = withOwnTiming.reduce((sum, group) => sum + (group.ownTimingInstances?.length ?? 0), 0);
  if (count === 0) return;
  toast(`${pluralize(count, "instance")} kept ${pluralWord(count, "its", "their")} own timing`, {
    duration: GROUP_TOAST_DURATION_MS,
    action: {
      label: "Share anyway",
      onClick: () => {
        for (const group of withOwnTiming) useProjectStore.getState().shareAllInstances(group.id);
      },
    },
  });
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

function showSharingBlockedToast(name: string): void {
  toast.error(`${name} keeps its own timing. Sync one instance fully first.`);
}

function showSharedSongEdgeToast(): void {
  toast("Stopped at the song edge: a shared instance would go past it", { id: SHARED_SONG_EDGE_TOAST_ID });
}

// -- Exports -------------------------------------------------------------------

export {
  offerToShareTiming,
  showGroupActionToast,
  showGroupedToast,
  showSharedSongEdgeToast,
  showPlacementBlockedToast,
  showSharingBlockedToast,
};
