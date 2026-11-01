import { tempoStats } from "@/domain/tempo/tempo-stats";
import { useBeatDetectionStore } from "@/stores/beat-detection";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { settingEntry } from "@/stores/settings-catalog";
import { SNAP_DEFAULTS, SNAP_DISTANCE_SETTING, SNAP_SWITCH_SETTING, type SnapSource } from "@/stores/settings-snap";
import { getEffectiveKeysArray } from "@/stores/shortcut-bindings";
import { BEAT_GRID_LINE_OPTIONS } from "@/ui/beat-grid-line-options";
import { InlineKeyBadge } from "@/ui/inline-key-badge";
import { Switch } from "@/ui/switch";
import { describeOnsetStatus } from "@/ui/vocal-onset-status-copy";
import { formatBpm } from "@/utils/format-bpm";
import { PopGroup, PopHead, PopNavButton, PopRow } from "@/ui/pop-layout";
import { isDetectionRunning } from "@/views/timeline/beat-grid/detection-progress";
import { SNAP_SOURCE_DISPLAY, SNAP_SOURCES } from "@/views/timeline/snap-source-display";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { IconAdjustmentsHorizontal, IconArrowsHorizontal, IconLoader2, IconRuler2 } from "@tabler/icons-react";

// -- Types ---------------------------------------------------------------------

interface SnapSourceRowProps {
  source: SnapSource;
  hint?: string;
  disabled?: boolean;
}

interface SnapMenuProps {
  onOpenBeatGrid: () => void;
  onOpenSnapDistance: () => void;
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

function useSnapDistanceSummary(): string {
  return useSettingsStore((s) => {
    const keys = SNAP_SOURCES.map((source) => SNAP_DISTANCE_SETTING[source]);
    if (keys.every((key) => s[key] === SNAP_DEFAULTS[key])) return "Default";
    const distances = new Set(keys.map((key) => s[key]));
    return distances.size === 1 ? `${[...distances][0]} px` : "Mixed";
  });
}

// -- Components ----------------------------------------------------------------

const SnapSourceRow: React.FC<SnapSourceRowProps> = ({ source, hint, disabled }) => {
  const setting = SNAP_SWITCH_SETTING[source];
  const { label, icon } = SNAP_SOURCE_DISPLAY[source];
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

const PlayheadToPointsRow: React.FC = () => {
  const checked = useSettingsStore((s) => s.snapPlayheadToPoints);
  const snapOn = useSettingsStore((s) => s.timelineSnap);
  const { label } = settingEntry("snapPlayheadToPoints");
  return (
    <PopRow label={label} icon={IconArrowsHorizontal} hint="When you click or drag it" dimmed={!snapOn}>
      <Switch
        checked={checked}
        disabled={!snapOn}
        label={label}
        onCheckedChange={(next) => useSettingsStore.getState().set("snapPlayheadToPoints", next)}
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

const SnapMenu: React.FC<SnapMenuProps> = ({ onOpenBeatGrid, onOpenSnapDistance }) => {
  const hasGrid = useProjectStore((s) => s.beatGrid !== null);
  const markersHint = useMarkersHint();
  const vocalOnsetsHint = useVocalOnsetsHint();
  const beatsHint = useBeatsHint();
  const distanceSummary = useSnapDistanceSummary();
  return (
    <>
      <PopHead title="Snap to" />
      <SnapOffNote />
      <PopGroup className="mt-1.5">
        <SnapSourceRow source="words" />
        <SnapSourceRow source="markers" hint={markersHint} />
        <SnapSourceRow source="onsets" hint={vocalOnsetsHint} />
        <SnapSourceRow source="beats" disabled={!hasGrid} hint={beatsHint} />
        <SnapSourceRow source="playhead" />
      </PopGroup>
      <div className="h-px my-1.5 -mx-1.5 bg-(--divider)" />
      <PopGroup className="mt-0">
        <PlayheadToPointsRow />
      </PopGroup>
      <div className="h-px my-1.5 -mx-1.5 bg-(--divider)" />
      <PopGroup className="mt-0">
        <PopNavButton
          label="Snap distance"
          icon={IconRuler2}
          summary={<span className="text-[12.5px] text-(--muted) tabular-nums">{distanceSummary}</span>}
          onClick={onOpenSnapDistance}
        />
        <PopNavButton
          label="Beat grid"
          icon={IconAdjustmentsHorizontal}
          summary={<BeatGridSummary />}
          onClick={onOpenBeatGrid}
        />
      </PopGroup>
    </>
  );
};

// -- Exports -------------------------------------------------------------------

export { SnapMenu };
