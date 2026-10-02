import { firstFullyTimedInstance, instancesInLineOrder } from "@/domain/group/shared-timing";
import type { LinkGroup } from "@/domain/group/template";
import type { LyricLine } from "@/domain/line/model";
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

function showKeptOwnTimingToast(lines: readonly LyricLine[], groups: readonly LinkGroup[]): void {
  const keeping = groups.filter((group) => group.ownTimingInstances?.length);
  const count = keeping.reduce((sum, group) => sum + (group.ownTimingInstances?.length ?? 0), 0);
  if (count === 0) return;
  const hasSource = keeping.every(
    (group) => firstFullyTimedInstance(lines, group.id, instancesInLineOrder(lines, group.id)) !== undefined,
  );
  const kept = `${pluralize(count, "instance")} kept ${pluralWord(count, "its", "their")} own timing`;
  toast(
    hasSource ? `${kept}: the shared timing would start before the song` : `${kept}. Sync one instance fully first.`,
    {
      duration: GROUP_TOAST_DURATION_MS,
    },
  );
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
  showGroupActionToast,
  showGroupedToast,
  showKeptOwnTimingToast,
  showSharedSongEdgeToast,
  showPlacementBlockedToast,
  showSharingBlockedToast,
};
