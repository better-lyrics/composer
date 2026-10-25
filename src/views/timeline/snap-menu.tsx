import { tempoStats } from "@/domain/tempo/tempo-stats";
import { useBeatDetectionStore } from "@/stores/beat-detection";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { Switch } from "@/ui/switch";
import { cn } from "@/utils/cn";
import { formatBpm } from "@/utils/format-bpm";
import { PopGroup, PopHead, PopRow } from "@/views/timeline/beat-grid/beat-grid-layout";
import { isDetectionRunning } from "@/views/timeline/beat-grid/detection-progress";
import {
  type Icon,
  IconAdjustmentsHorizontal,
  IconChevronRight,
  IconLoader2,
  IconMapPin,
  IconMetronome,
  IconTextSize,
  IconWaveSine,
} from "@tabler/icons-react";

// -- Types ---------------------------------------------------------------------

type SnapSourceKey = "snapWordsAndLines" | "snapMarkers" | "vocalOnsetSnap" | "beatSnap";

interface SnapSourceRowProps {
  setting: SnapSourceKey;
  label: string;
  icon: Icon;
  hint?: string;
  disabled?: boolean;
}

// -- Components ----------------------------------------------------------------

const SnapSourceRow: React.FC<SnapSourceRowProps> = ({ setting, label, icon, hint, disabled }) => {
  const checked = useSettingsStore((s) => s[setting]);
  const snapOn = useSettingsStore((s) => s.timelineSnap);
  const dimmed = !snapOn || disabled;
  return (
    <PopRow label={label} icon={icon} hint={hint} dimmed={dimmed}>
      <Switch
        checked={checked && !disabled}
        disabled={disabled}
        label={label}
        onCheckedChange={(next) => useSettingsStore.getState().set(setting, next)}
        className={cn(dimmed && !disabled && "opacity-60")}
      />
    </PopRow>
  );
};

const BeatGridSummary: React.FC = () => {
  const grid = useProjectStore((s) => s.beatGrid);
  const running = useBeatDetectionStore((s) => isDetectionRunning(s.status));
  const stats = grid ? tempoStats(grid) : null;
  if (running) {
    return (
      <IconLoader2
        aria-label="Finding beats"
        className="size-4 text-composer-accent-text animate-spin motion-reduce:animate-none"
      />
    );
  }
  return (
    <span className="text-[12.5px] text-(--muted) tabular-nums">
      {stats ? `${formatBpm(stats.bpm)} BPM` : "Set up"}
    </span>
  );
};

const SnapMenu: React.FC<{ onOpenBeatGrid: () => void }> = ({ onOpenBeatGrid }) => {
  const hasGrid = useProjectStore((s) => s.beatGrid !== null);
  return (
    <>
      <PopHead title="Snap to" />
      <PopGroup className="mt-1.5">
        <SnapSourceRow setting="snapWordsAndLines" label="Words and lines" icon={IconTextSize} />
        <SnapSourceRow setting="snapMarkers" label="Markers" icon={IconMapPin} />
        <SnapSourceRow setting="vocalOnsetSnap" label="Vocal onsets" icon={IconWaveSine} />
        <SnapSourceRow
          setting="beatSnap"
          label="Beats"
          icon={IconMetronome}
          disabled={!hasGrid}
          hint={hasGrid ? undefined : "Set up a beat grid first."}
        />
      </PopGroup>
      <PopGroup>
        <button
          type="button"
          onClick={onOpenBeatGrid}
          className="group flex items-center gap-3 w-full min-h-9 pl-2.5 pr-2 rounded-lg text-left cursor-pointer transition-colors duration-150 hover:bg-(--layer-2)"
        >
          <IconAdjustmentsHorizontal aria-hidden="true" className="size-4 shrink-0 text-(--muted)" />
          <span className="flex-1 min-w-0 text-[13px] font-medium text-(--label)">Beat grid</span>
          <span className="flex items-center gap-2">
            <BeatGridSummary />
            <IconChevronRight
              aria-hidden="true"
              className="size-[15px] text-(--muted) transition-colors duration-150 group-hover:text-composer-text"
            />
          </span>
        </button>
      </PopGroup>
    </>
  );
};

// -- Exports -------------------------------------------------------------------

export { SnapMenu };
