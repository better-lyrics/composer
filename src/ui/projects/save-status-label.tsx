import { useOpenProjectDeleted } from "@/hooks/useOpenProjectDeleted";
import { useOpenProjectId } from "@/hooks/useOpenProjectId";
import { keepOpenProjectAsNew } from "@/lib/open-project-deleted";
import { type SaveStatus, getSaveStatus, subscribeSaveStatus } from "@/lib/save-status";
import { Button } from "@/ui/button";
import { Tooltip } from "@/ui/tooltip";
import { IconAlertTriangle, IconCheck, IconLoader2 } from "@tabler/icons-react";
import { useState, useSyncExternalStore } from "react";

// -- Constants ----------------------------------------------------------------

const SAVE_STATUS_COPY: Record<SaveStatus, string> = {
  saved: "Saved",
  saving: "Saving",
  failed: "Not saved",
};

// -- Helpers ------------------------------------------------------------------

function useSaveStatus(): SaveStatus {
  return useSyncExternalStore(subscribeSaveStatus, getSaveStatus, getSaveStatus);
}

function nextAnnouncement(status: SaveStatus, previous: string): string {
  if (status === "failed") return SAVE_STATUS_COPY.failed;
  if (status === "saved" && previous === SAVE_STATUS_COPY.failed) return SAVE_STATUS_COPY.saved;
  return previous;
}

// -- Components ---------------------------------------------------------------

const NotSavedLabel: React.FC = () => (
  <span className="inline-flex items-center gap-[3px] text-[11.5px] font-medium text-composer-warning">
    <IconAlertTriangle aria-hidden="true" className="size-3.5" />
    {SAVE_STATUS_COPY.failed}
  </span>
);

const SaveStatusIcon: React.FC<{ status: SaveStatus }> = ({ status }) => {
  if (status === "failed") return <NotSavedLabel />;
  if (status === "saving") {
    return (
      <IconLoader2
        aria-hidden="true"
        className="size-3.5 text-composer-text-faint animate-[spin_900ms_linear_infinite] motion-reduce:animate-none"
      />
    );
  }
  return (
    <span title={SAVE_STATUS_COPY.saved} className="inline-flex">
      <IconCheck aria-hidden="true" className="size-3.5 text-composer-text-faint" />
    </span>
  );
};

const SaveStatusGlyph: React.FC = () => {
  const status = useSaveStatus();
  const openId = useOpenProjectId();
  const deletedElsewhere = useOpenProjectDeleted();
  if (!openId || deletedElsewhere) return null;
  return <SaveStatusIcon status={status} />;
};

// Rendered beside the project switcher trigger, never inside it: a button cannot hold another button.
const DeletedProjectSaveButton: React.FC = () => {
  const deletedElsewhere = useOpenProjectDeleted();
  if (!deletedElsewhere) return null;
  return (
    <Tooltip content="Not saved ・ Keep as new project" placement="bottom" className="shrink-0">
      <Button
        variant="ghost"
        size="sm"
        aria-label="Not saved, keep as new project"
        onClick={keepOpenProjectAsNew}
        className="-ml-1 shrink-0 px-1.5"
      >
        <IconAlertTriangle aria-hidden="true" className="size-3.5 text-composer-warning" />
      </Button>
    </Tooltip>
  );
};

const SaveStatusAnnouncer: React.FC = () => {
  const status = useSaveStatus();
  const [announcement, setAnnouncement] = useState("");
  const next = nextAnnouncement(status, announcement);
  if (next !== announcement) setAnnouncement(next);
  return (
    <span role="status" aria-atomic="true" className="sr-only">
      {announcement}
    </span>
  );
};

// -- Exports ------------------------------------------------------------------

export { DeletedProjectSaveButton, SAVE_STATUS_COPY, SaveStatusAnnouncer, SaveStatusGlyph, SaveStatusIcon };
