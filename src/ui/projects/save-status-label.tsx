import { useOpenProjectId } from "@/hooks/useOpenProjectId";
import { type SaveStatus, getSaveStatus, subscribeSaveStatus } from "@/lib/save-status";
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

const SaveStatusIcon: React.FC<{ status: SaveStatus }> = ({ status }) => {
  if (status === "failed") {
    return (
      <span className="inline-flex items-center gap-[3px] text-[11.5px] font-medium text-composer-warning">
        <IconAlertTriangle aria-hidden="true" className="size-3.5" />
        {SAVE_STATUS_COPY.failed}
      </span>
    );
  }
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
  if (!openId) return null;
  return <SaveStatusIcon status={status} />;
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

export { SAVE_STATUS_COPY, SaveStatusAnnouncer, SaveStatusGlyph, SaveStatusIcon };
