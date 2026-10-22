import { useSettingsStore } from "@/stores/settings";
import { Switch } from "@/ui/switch";
import { DETECTING_VOCAL_ONSETS } from "@/ui/vocal-onset-status-copy";
import { pluralize } from "@/utils/pluralize";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { IconWaveSine } from "@tabler/icons-react";

// -- Status hint --------------------------------------------------------------

function describeOnsetStatus(
  status: "idle" | "processing" | "error",
  pointCount: number,
  error: string | null,
): string {
  if (status === "processing") return DETECTING_VOCAL_ONSETS;
  if (status === "error") return error ? `Detection failed: ${error}` : "Detection failed";
  if (pointCount > 0) return pluralize(pointCount, "snap point");
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
    <div className="flex items-center gap-2.5 select-none">
      <IconWaveSine className="size-4 shrink-0 text-(--muted)" />
      <div className="flex flex-1 flex-col gap-0.5 min-w-0">
        <span className="text-[13px] font-medium text-composer-text">Snap to vocal onsets</span>
        <span className="text-[12.5px] leading-[1.45] text-(--muted) select-text truncate">{hint}</span>
      </div>
      <Switch
        checked={enabled}
        label="Snap to vocal onsets"
        onCheckedChange={(checked) => useSettingsStore.getState().set("vocalOnsetSnap", checked)}
      />
    </div>
  );
};

// -- Exports -------------------------------------------------------------------

export { VocalOnsetSnapToggle };
