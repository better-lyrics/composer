import { tempoStats } from "@/domain/tempo/tempo-stats";
import { useAudioStore } from "@/stores/audio";
import { useBeatDetectionStore } from "@/stores/beat-detection";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { getEffectiveKeysArray } from "@/stores/shortcut-bindings";
import { InlineKeyBadge } from "@/ui/inline-key-badge";
import { Popover } from "@/ui/popover";
import { Tooltip } from "@/ui/tooltip";
import { cn } from "@/utils/cn";
import { formatBpm } from "@/utils/format-bpm";
import { keepSpaceForFocusedControl } from "@/views/timeline/beat-grid/beat-grid-layout";
import { BeatGridPopoverBody } from "@/views/timeline/beat-grid/beat-grid-popover";
import { detectionPercent, isDetectionRunning } from "@/views/timeline/beat-grid/detection-progress";
import { usePlayheadBeat } from "@/views/timeline/beat-grid/use-playhead-beat";
import { IconAlertTriangle, IconLoader2, IconWaveSine } from "@tabler/icons-react";
import { useRef } from "react";

// -- Constants -----------------------------------------------------------------

const FLASH_MS = 110;
const TEMPO_NUMBER_CLASS =
  "font-mono text-xs font-semibold leading-none tabular-nums text-(--label) transition-colors duration-160 ease-[cubic-bezier(0.22,1,0.36,1)] group-aria-expanded:text-composer-text data-beat:text-composer-accent-text data-beat:duration-0";

// -- Components ----------------------------------------------------------------

const CornerTempo: React.FC<{ bpm: string; dimmed: boolean }> = ({ bpm, dimmed }) => {
  const grid = useProjectStore((s) => s.beatGrid);
  const numberRef = useRef<HTMLElement>(null);
  const flashedAt = useRef<number | null>(null);

  usePlayheadBeat(grid, "beat-grid-corner", (index, changed, now) => {
    const number = numberRef.current;
    if (!number) return;
    const playing = useAudioStore.getState().isPlaying;
    if (flashedAt.current !== null && (!playing || now - flashedAt.current >= FLASH_MS)) {
      number.removeAttribute("data-beat");
      flashedAt.current = null;
    }
    if (changed && playing && index >= 0) {
      number.setAttribute("data-beat", "");
      flashedAt.current = now;
    }
  });

  return (
    <span className={cn("grid justify-items-center gap-0.5", dimmed && "opacity-50")}>
      <b ref={numberRef} className={TEMPO_NUMBER_CLASS}>
        {bpm}
      </b>
      <span className="text-[9.5px] font-medium leading-none text-composer-text-faint">BPM</span>
    </span>
  );
};

const CornerFace: React.FC = () => {
  const grid = useProjectStore((s) => s.beatGrid);
  const visible = useSettingsStore((s) => s.beatGridVisible);
  const status = useBeatDetectionStore((s) => s.status);
  const percent = useBeatDetectionStore(detectionPercent);
  const stats = grid ? tempoStats(grid) : null;

  if (isDetectionRunning(status)) {
    return (
      <>
        <IconLoader2
          aria-hidden="true"
          className="size-4 text-composer-accent-text animate-spin motion-reduce:animate-none"
        />
        <span className="font-mono text-xs font-semibold leading-none tabular-nums text-(--label)">{percent}%</span>
      </>
    );
  }
  if (status === "error") {
    return (
      <>
        <IconWaveSine aria-hidden="true" className="size-4" />
        <IconAlertTriangle aria-hidden="true" className="size-[13px] text-composer-warning" />
      </>
    );
  }
  return (
    <>
      <IconWaveSine aria-hidden="true" className="size-4" />
      {stats && <CornerTempo bpm={formatBpm(stats.bpm)} dimmed={!visible} />}
    </>
  );
};

function useCornerLabel(): string {
  const grid = useProjectStore((s) => s.beatGrid);
  const status = useBeatDetectionStore((s) => s.status);
  const stats = grid ? tempoStats(grid) : null;
  if (isDetectionRunning(status)) return "Beat grid, finding beats";
  if (status === "error") return "Beat grid, detection failed";
  return stats ? `Beat grid, ${formatBpm(stats.bpm)} BPM` : "Beat grid";
}

const CornerButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { ref?: React.Ref<HTMLButtonElement> }> = (
  props,
) => (
  <button
    type="button"
    aria-label={useCornerLabel()}
    {...props}
    className="group flex flex-col items-center justify-center gap-1.5 size-full cursor-pointer select-none text-composer-text-faint transition-colors duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] hover:text-(--label) hover:bg-[color-mix(in_oklab,var(--ink)_5%,var(--gutter-bg))] aria-expanded:text-composer-accent-text aria-expanded:bg-[color-mix(in_oklab,var(--color-composer-accent)_10%,var(--gutter-bg))]"
  >
    <CornerFace />
  </button>
);

const CornerTooltip: React.FC = () => {
  const hasGrid = useProjectStore((s) => s.beatGrid !== null);
  const showHints = useSettingsStore((s) => s.showShortcutHints);
  return (
    <span className="inline-flex items-center gap-1.5">
      Beat grid
      {hasGrid && showHints && <InlineKeyBadge keys={getEffectiveKeysArray("timeline.toggleBeatGrid")} />}
    </span>
  );
};

// The cell sits in the Timeline scroll host, which starts a marquee on mousedown.
const BeatGridCorner: React.FC = () => (
  <div
    onMouseDown={(e) => e.stopPropagation()}
    onKeyDown={keepSpaceForFocusedControl}
    className="absolute top-0 left-0 z-100 grid w-12 h-20 border-b border-r-2 border-(--divider) bg-(--gutter-bg)"
  >
    <Tooltip content={<CornerTooltip />} placement="right">
      <Popover placement="right-start" aria-label="Beat grid" trigger={<CornerButton />}>
        <BeatGridPopoverBody />
      </Popover>
    </Tooltip>
  </div>
);

// -- Exports -------------------------------------------------------------------

export { BeatGridCorner };
