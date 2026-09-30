import type { LinkGroup } from "@/domain/group/template";
import { useProjectStore } from "@/stores/project";
import { pluralWord, pluralize } from "@/utils/pluralize";
import { toast } from "sonner";

// -- Constants -----------------------------------------------------------------

const GROUP_TOAST_DURATION_MS = 8000;

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

// -- Exports -------------------------------------------------------------------

export { offerToShareTiming, showGroupActionToast };
