import type { BeatGrid } from "@/domain/tempo/beat-grid";
import { canDouble, canHalve, doubled, halved, isEdited, resetGrid, withBarOneAt } from "@/domain/tempo/grid-edits";
import { gridDensity } from "@/domain/tempo/grid-points";
import { type TempoStats, tempoStats } from "@/domain/tempo/tempo-stats";
import { livePlaybackTime, playableFile, useAudioStore } from "@/stores/audio";
import { useBeatDetectionStore } from "@/stores/beat-detection";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { getEffectiveKeysArray } from "@/stores/shortcut-bindings";
import { BEAT_GRID_LINE_OPTIONS } from "@/ui/beat-grid-line-options";
import { InlineKeyBadge } from "@/ui/inline-key-badge";
import { SegmentedControl } from "@/ui/segmented-control";
import { Switch } from "@/ui/switch";
import { Tooltip } from "@/ui/tooltip";
import { formatBpm } from "@/utils/format-bpm";
import { PopButton, PopGroup, PopHead, PopIconButton, PopRow } from "@/views/timeline/beat-grid/beat-grid-layout";
import { OffsetStepper } from "@/views/timeline/beat-grid/offset-stepper";
import { TempoDisplay } from "@/views/timeline/beat-grid/tempo-display";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { IconArrowBackUp, IconFlag, IconHandFinger, IconMetronome, IconRefresh } from "@tabler/icons-react";

// -- Interfaces ----------------------------------------------------------------

interface BeatGridReadyProps {
  grid: BeatGrid;
  onSetByHand: () => void;
  onBack?: () => void;
}

// -- Components ----------------------------------------------------------------

const ShowOnWaveformRow: React.FC = () => {
  const visible = useSettingsStore((s) => s.beatGridVisible);
  const showHints = useSettingsStore((s) => s.showShortcutHints);
  return (
    <PopRow
      label={
        <>
          Show on waveform
          {showHints && <InlineKeyBadge keys={getEffectiveKeysArray("timeline.toggleBeatGrid")} />}
        </>
      }
    >
      <Switch
        checked={visible}
        onCheckedChange={(checked) => useSettingsStore.getState().set("beatGridVisible", checked)}
        label="Show on waveform"
      />
    </PopRow>
  );
};

const GridGroup: React.FC<{ grid: BeatGrid }> = ({ grid }) => {
  const lines = useSettingsStore((s) => s.beatGridLines);
  const zoom = useTimelineStore((s) => s.zoom);
  const thinned = gridDensity(grid, zoom, lines).thinned;
  return (
    <PopGroup label="Grid">
      <PopRow label="Lines">
        <SegmentedControl
          size="sm"
          aria-label="Grid lines"
          value={lines}
          options={BEAT_GRID_LINE_OPTIONS}
          onChange={(value) => useSettingsStore.getState().set("beatGridLines", value)}
        />
      </PopRow>
      {thinned && <p className="px-2.5 text-xs leading-[1.45] text-(--muted)">Zoom in to see finer lines.</p>}
      <PopRow label="Offset">
        <OffsetStepper grid={grid} />
      </PopRow>
    </PopGroup>
  );
};

const FixGridGroup: React.FC<{ grid: BeatGrid; stats: TempoStats; onSetByHand: () => void }> = ({
  grid,
  stats,
  onSetByHand,
}) => {
  const apply = useProjectStore((s) => s.applyBeatGridWithHistory);
  return (
    <PopGroup label="Fix the grid">
      <PopRow label="Bar 1">
        <PopButton
          icon={IconFlag}
          title="Makes the beat at the playhead the first beat of a bar"
          onClick={() => apply(withBarOneAt(grid, livePlaybackTime()))}
        >
          Set at playhead
        </PopButton>
      </PopRow>
      <PopRow label="Tempo">
        <div className="flex gap-1.5">
          <PopButton icon={IconHandFinger} onClick={onSetByHand}>
            Set by hand
          </PopButton>
          <Tooltip content={`${formatBpm(stats.bpm / 2)} BPM`}>
            <PopButton disabled={!canHalve(grid)} onClick={() => apply(halved(grid))}>
              Half
            </PopButton>
          </Tooltip>
          <Tooltip content={`${formatBpm(stats.bpm * 2)} BPM`}>
            <PopButton disabled={!canDouble(grid)} onClick={() => apply(doubled(grid))}>
              Double
            </PopButton>
          </Tooltip>
        </div>
      </PopRow>
    </PopGroup>
  );
};

const EditedFooter: React.FC<{ grid: BeatGrid; duration: number }> = ({ grid, duration }) => (
  <div className="flex items-center justify-between mt-3 -mx-1.5 pt-1.5 pb-0.5 pl-4 pr-2.5 border-t border-(--divider)">
    <span className="text-xs leading-[1.3] text-(--muted)">Edited</span>
    <PopButton
      variant="ghost"
      icon={IconArrowBackUp}
      onClick={() => useProjectStore.getState().applyBeatGridWithHistory(resetGrid(grid, duration))}
    >
      {grid.source === "manual" ? "Reset" : "Reset to detected"}
    </PopButton>
  </div>
);

const BeatGridReady: React.FC<BeatGridReadyProps> = ({ grid, onSetByHand, onBack }) => {
  const duration = useAudioStore((s) => s.duration);
  const canDetect = useAudioStore((s) => playableFile(s.source) !== null);
  const stats = tempoStats(grid);
  const detectLabel = grid.source === "manual" ? "Detect beats" : "Detect again";

  return (
    <>
      <PopHead
        title="Beat grid"
        onBack={onBack}
        action={
          <PopIconButton
            label={detectLabel}
            icon={grid.source === "manual" ? IconMetronome : IconRefresh}
            disabled={!canDetect}
            onClick={() => void useBeatDetectionStore.getState().run()}
          />
        }
      />
      {stats && <TempoDisplay grid={grid} stats={stats} />}
      <PopGroup>
        <ShowOnWaveformRow />
      </PopGroup>
      <GridGroup grid={grid} />
      {stats && <FixGridGroup grid={grid} stats={stats} onSetByHand={onSetByHand} />}
      {isEdited(grid, duration) ? <EditedFooter grid={grid} duration={duration} /> : <div className="h-1" />}
    </>
  );
};

// -- Exports -------------------------------------------------------------------

export { BeatGridReady };
