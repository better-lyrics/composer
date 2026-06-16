import { useSettingsStore } from "@/stores/settings";
import { cn } from "@/utils/cn";
import { IconWaveSine } from "@tabler/icons-react";
import { useTimelineStore } from "@/views/timeline/timeline-store";

// -- Status hint --------------------------------------------------------------

function describeOnsetStatus(
  status: "idle" | "processing" | "error",
  pointCount: number,
  error: string | null,
): string {
  if (status === "processing") return "Detecting onsets...";
  if (status === "error") return error ? `Detection failed: ${error}` : "Detection failed";
  if (pointCount > 0) return `${pointCount} snap point${pointCount === 1 ? "" : "s"}`;
  return "Separate vocals to detect onsets";
}

// -- Components ----------------------------------------------------------------

const VocalOnsetSnapToggle: React.FC = () => {
  const enabled = useSettingsStore((s) => s.vocalOnsetSnap);
  const detectionStatus = useTimelineStore((s) => s.vocalOnsetDetectionStatus);
  const pointCount = useTimelineStore((s) => s.vocalOnsetSnapPoints.length);
  const detectionError = useTimelineStore((s) => s.vocalOnsetDetectionError);

  const hint = describeOnsetStatus(detectionStatus, pointCount, detectionError);

  return (
    <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-md select-none">
      <IconWaveSine
        className={cn("size-4 shrink-0", enabled ? "text-composer-accent-text" : "text-composer-text opacity-55")}
      />
      <div className="flex flex-1 flex-col gap-0.5 min-w-0">
        <span className="text-sm text-composer-text">Snap to vocal onsets</span>
        <span className="text-xs text-composer-text-muted select-text truncate">{hint}</span>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label="Snap to vocal onsets"
        onClick={() => useSettingsStore.getState().set("vocalOnsetSnap", !enabled)}
        className={cn(
          "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors",
          enabled ? "bg-composer-accent" : "bg-composer-button",
        )}
      >
        <span
          className={cn(
            "pointer-events-none inline-block size-4 rounded-full bg-white shadow transform transition-transform mt-0.5",
            enabled ? "translate-x-4.5" : "translate-x-0.5",
          )}
        />
      </button>
    </div>
  );
};

// -- Exports -------------------------------------------------------------------

export { VocalOnsetSnapToggle };
