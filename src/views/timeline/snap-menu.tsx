import { tempoStats } from "@/domain/tempo/tempo-stats";
import { useBeatDetectionStore } from "@/stores/beat-detection";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { getEffectiveKeysArray } from "@/stores/shortcut-bindings";
import { BEAT_GRID_LINE_OPTIONS } from "@/ui/beat-grid-line-options";
import { InlineKeyBadge } from "@/ui/inline-key-badge";
import { Switch } from "@/ui/switch";
import { describeOnsetStatus } from "@/ui/vocal-onset-status-copy";
import { formatBpm } from "@/utils/format-bpm";
import { PopGroup, PopHead, PopRow } from "@/views/timeline/beat-grid/beat-grid-layout";
import { isDetectionRunning } from "@/views/timeline/beat-grid/detection-progress";
import { useTimelineStore } from "@/views/timeline/timeline-store";
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

// -- Hooks ---------------------------------------------------------------------

function useMarkersHint(): string {
  const count = useProjectStore((s) => s.customSnapPoints.length);
  return count > 0 ? `${count} in this song` : "None yet";
}

function useVocalOnsetsHint(): string {
  const status = useTimelineStore((s) => s.vocalOnsetDetectionStatus);
  const pointCount = useTimelineStore((s) => s.vocalOnsetSnapPoints.length);
  const error = useTimelineStore((s) => s.vocalOnsetDetectionError);
  return describeOnsetStatus(status, pointCount, error);
}

function useBeatsHint(): string {
  const grid = useProjectStore((s) => s.beatGrid);
  const status = useBeatDetectionStore((s) => s.status);
  const lines = useSettingsStore((s) => s.beatGridLines);
  const visible = useSettingsStore((s) => s.beatGridVisible);
  if (isDetectionRunning(status)) return "Finding beats…";
  if (status === "error") return "Detection failed";
  const stats = grid ? tempoStats(grid) : null;
  if (!stats) return "Set a tempo first";
  if (!visible) return "Grid hidden, so beats don't snap";
  const linesLabel = BEAT_GRID_LINE_OPTIONS.find((option) => option.value === lines)?.label ?? "Beat";
  return `${formatBpm(stats.bpm)} BPM ・ ${linesLabel} lines`;
}

// -- Components ----------------------------------------------------------------

const SnapSourceRow: React.FC<SnapSourceRowProps> = ({ setting, label, icon, hint, disabled }) => {
  const checked = useSettingsStore((s) => s[setting]);
  const snapOn = useSettingsStore((s) => s.timelineSnap);
  return (
    <PopRow label={label} icon={icon} hint={hint} dimmed={!snapOn || disabled}>
      <Switch
        checked={checked && !disabled}
        disabled={!snapOn || disabled}
        label={label}
        onCheckedChange={(next) => useSettingsStore.getState().set(setting, next)}
      />
    </PopRow>
  );
};

const SnapOffNote: React.FC = () => {
  const snapOn = useSettingsStore((s) => s.timelineSnap);
  if (snapOn) return null;
  return (
    <p className="px-2.5 mt-1 text-xs leading-[1.45] text-pretty text-(--muted)">
      Snap is off. Press <InlineKeyBadge keys={getEffectiveKeysArray("timeline.toggleSnap")} /> or the magnet to turn it
      on.
    </p>
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
  const markersHint = useMarkersHint();
  const vocalOnsetsHint = useVocalOnsetsHint();
  const beatsHint = useBeatsHint();
  return (
    <>
      <PopHead title="Snap to" />
      <SnapOffNote />
      <PopGroup className="mt-1.5">
        <SnapSourceRow setting="snapWordsAndLines" label="Words and lines" icon={IconTextSize} />
        <SnapSourceRow setting="snapMarkers" label="Markers" icon={IconMapPin} hint={markersHint} />
        <SnapSourceRow setting="vocalOnsetSnap" label="Vocal onsets" icon={IconWaveSine} hint={vocalOnsetsHint} />
        <SnapSourceRow setting="beatSnap" label="Beats" icon={IconMetronome} disabled={!hasGrid} hint={beatsHint} />
      </PopGroup>
      <div className="h-px my-1.5 -mx-1.5 bg-(--divider)" />
      <PopGroup className="mt-0">
        <button
          type="button"
          onClick={onOpenBeatGrid}
          className="group flex items-center gap-3 w-full min-h-9 pl-2.5 pr-1 rounded-lg text-left cursor-pointer transition-colors duration-150 hover:bg-(--layer-2)"
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
