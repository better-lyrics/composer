import { useOpenProjectDeleted } from "@/hooks/useOpenProjectDeleted";
import { keepOpenProjectAsNew } from "@/lib/open-project-deleted";
import type { NoticeAction, NoticeKind } from "@/ui/notices/notice-model";
import { IconAlertTriangle, IconCopyPlus } from "@tabler/icons-react";

// -- Constants ----------------------------------------------------------------

const KEEP_ACTION: NoticeAction = { label: "Keep as new project", icon: IconCopyPlus, run: keepOpenProjectAsNew };

const DELETED_PROJECT_NOTICE: NoticeKind = {
  id: "deleted",
  icon: IconAlertTriangle,
  tone: "warn",
  summary: "This project was deleted in another tab",
  singleAction: KEEP_ACTION,
  rows: [
    {
      key: "deleted",
      fingerprints: [],
      title: "This project was deleted in another tab",
      detail: "Composer stopped saving this project.",
      accept: KEEP_ACTION,
      dismissedLabel: "deleted project notice",
    },
  ],
  dismissedFingerprints: [],
  modalTitle: "Deleted project",
};

// -- Hook ---------------------------------------------------------------------

function useDeletedProjectNotice(): NoticeKind | null {
  return useOpenProjectDeleted() ? DELETED_PROJECT_NOTICE : null;
}

// -- Exports ------------------------------------------------------------------

export { useDeletedProjectNotice };
