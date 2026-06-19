import { getLinkScope, isLinkedSibling } from "@/domain/group/linking";
import { bgVoice } from "@/domain/line/voices";
import { useConfirmStore } from "@/stores/confirm-store";
import { useProjectStore } from "@/stores/project";

// -- Operation ----------------------------------------------------------------

async function removeBackgroundWithConfirm(lineId: string): Promise<void> {
  const lines = useProjectStore.getState().lines;
  const line = lines.find((l) => l.id === lineId);
  if (!line || bgVoice(line) === null) return;

  const linkScope = getLinkScope(line);
  const hasLinkedSiblings = linkScope ? lines.some((l) => l.id !== lineId && isLinkedSibling(l, linkScope)) : false;

  const ok = await useConfirmStore.getState().open({
    title: "Remove background vocals?",
    description: hasLinkedSiblings
      ? "The background vocals on this line and its linked instances will be removed."
      : "The background vocals on this line will be removed.",
    confirmLabel: "Remove background",
    variant: "destructive",
    settingsKey: "confirmRemoveBackground",
    recoverable: true,
  });
  if (!ok) return;
  useProjectStore.getState().removeLineBackground(lineId);
}

// -- Exports ------------------------------------------------------------------

export { removeBackgroundWithConfirm };
