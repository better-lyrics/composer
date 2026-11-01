import { useSeparationStore } from "@/stores/separation";
import { useSettingsStore } from "@/stores/settings";
import { Switch } from "@/ui/switch";
import { describeOnsetStatus } from "@/ui/vocal-onset-status-copy";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { IconWaveSine } from "@tabler/icons-react";

// -- Components ----------------------------------------------------------------

const VocalOnsetSnapToggle: React.FC = () => {
  const enabled = useSettingsStore((s) => s.vocalOnsetSnap);
  const detectionStatus = useTimelineStore((s) => s.vocalOnsetDetectionStatus);
  const pointCount = useTimelineStore((s) => s.vocalOnsetSnapPoints.length);
  const detectionError = useTimelineStore((s) => s.vocalOnsetDetectionError);

  const hasVocals = useSeparationStore((s) => s.availableStems.includes("vocals"));

  const hint = hasVocals ? describeOnsetStatus(detectionStatus, pointCount, detectionError) : "Needs a vocals stem";

  return (
    <div className="flex items-center gap-2.5 select-none">
      <IconWaveSine className="size-4 shrink-0 text-(--muted)" />
      <div className="flex flex-1 flex-col gap-0.5 min-w-0">
        <span className="text-[13px] font-medium text-composer-text">Snap to vocal onsets</span>
        <span className="text-[12.5px] leading-[1.45] text-(--muted) select-text truncate">{hint}</span>
      </div>
      <Switch
        checked={enabled && hasVocals}
        disabled={!hasVocals}
        label="Snap to vocal onsets"
        onCheckedChange={(checked) => useSettingsStore.getState().set("vocalOnsetSnap", checked)}
      />
    </div>
  );
};

// -- Exports -------------------------------------------------------------------

export { VocalOnsetSnapToggle };
