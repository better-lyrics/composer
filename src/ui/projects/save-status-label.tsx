import { useOpenProjectId } from "@/hooks/useOpenProjectId";
import { type SaveStatus, getSaveStatus, subscribeSaveStatus } from "@/lib/save-status";
import { cn } from "@/utils/cn";
import { IconAlertTriangle, IconCheck, IconLoader2 } from "@tabler/icons-react";
import { useState, useSyncExternalStore } from "react";

// -- Constants ----------------------------------------------------------------

const STATUS_COPY: Record<SaveStatus, string> = {
  saved: "Saved",
  saving: "Saving",
  failed: "Not saved",
};

// -- Sub-components -----------------------------------------------------------

const StatusIcon: React.FC<{ status: SaveStatus }> = ({ status }) => {
  if (status === "saving")
    return <IconLoader2 aria-hidden="true" className="size-3.5 animate-spin motion-reduce:animate-none" />;
  if (status === "failed") return <IconAlertTriangle aria-hidden="true" className="size-3.5" />;
  return <IconCheck aria-hidden="true" className="size-3.5" />;
};

// -- Component ----------------------------------------------------------------

function nextAnnouncement(status: SaveStatus, previous: string): string {
  if (status === "failed") return STATUS_COPY.failed;
  if (status === "saved" && previous === STATUS_COPY.failed) return STATUS_COPY.saved;
  return previous;
}

const SaveStatusLabel: React.FC = () => {
  const status = useSyncExternalStore(subscribeSaveStatus, getSaveStatus, getSaveStatus);
  const openId = useOpenProjectId();
  const [announcement, setAnnouncement] = useState("");
  const next = nextAnnouncement(status, announcement);
  if (next !== announcement) setAnnouncement(next);
  return (
    <>
      {openId && (
        <span
          className={cn(
            "inline-flex items-center gap-1 ml-2.5 text-xs whitespace-nowrap select-none",
            status === "failed" ? "text-composer-warning" : "text-composer-text-muted",
          )}
        >
          <StatusIcon status={status} />
          {STATUS_COPY[status]}
        </span>
      )}
      <span role="status" aria-atomic="true" className="sr-only">
        {announcement}
      </span>
    </>
  );
};

// -- Exports ------------------------------------------------------------------

export { SaveStatusLabel };
