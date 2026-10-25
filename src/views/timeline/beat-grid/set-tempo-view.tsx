import { manualGrid } from "@/domain/tempo/grid-edits";
import { EMPTY_TAPS, type TapState, isValidBpm, sanitizeBpmInput, tapTempo } from "@/domain/tempo/tap-tempo";
import { tempoStats } from "@/domain/tempo/tempo-stats";
import { livePlaybackTime, useAudioStore } from "@/stores/audio";
import { useBeatDetectionStore } from "@/stores/beat-detection";
import { useProjectStore } from "@/stores/project";
import { SegmentedControl } from "@/ui/segmented-control";
import { cn } from "@/utils/cn";
import { formatBpm } from "@/utils/format-bpm";
import { formatTime } from "@/utils/format-time";
import { pluralize } from "@/utils/pluralize";
import { matchesShortcutBinding } from "@/utils/shortcut-matcher";
import { isTypingTarget } from "@/utils/typing-target";
import { PopActions, PopButton, PopGroup, PopHead, PopRow } from "@/views/timeline/beat-grid/beat-grid-layout";
import { TapKey } from "@/views/timeline/beat-grid/tap-key";
import { BPM_NUMBER_CLASS, DISPLAY_SURFACE, StaticLeds } from "@/views/timeline/beat-grid/tempo-display";
import { useRef, useState } from "react";
import { flushSync } from "react-dom";

// -- Types ---------------------------------------------------------------------

type Meter = "3" | "4";

// -- Constants -----------------------------------------------------------------

const TAPS_FOR_TEMPO = 4;
const MIN_FIELD_CH = 2;
const METER_OPTIONS: readonly { value: Meter; label: string }[] = [
  { value: "3", label: "3" },
  { value: "4", label: "4" },
];

// -- Helpers -------------------------------------------------------------------

function tapStatus(taps: TapState | null): string {
  if (!taps) return "Play, then tap along";
  const count = taps.taps.length;
  if (count < TAPS_FOR_TEMPO) return `Tap ${pluralize(TAPS_FOR_TEMPO - count, "more time")}`;
  return `From ${count} taps`;
}

// -- Components ----------------------------------------------------------------

const PlayheadTime: React.FC = () => {
  const currentTime = useAudioStore((s) => s.currentTime);
  return (
    <span className="text-[12.5px] text-(--muted) whitespace-nowrap">
      At the playhead{" "}
      <span className="ml-1 font-mono text-xs font-medium tabular-nums text-(--label) select-text">
        {formatTime(currentTime, 2)}
      </span>
    </span>
  );
};

const SetTempoView: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  const [text, setText] = useState(() => {
    const grid = useProjectStore.getState().beatGrid;
    const stats = grid ? tempoStats(grid) : null;
    return stats ? formatBpm(stats.bpm) : "";
  });
  const [taps, setTaps] = useState<TapState | null>(null);
  const [meter, setMeter] = useState<Meter>(() => (useProjectStore.getState().beatGrid?.beatsPerBar === 3 ? "3" : "4"));
  const fieldRef = useRef<HTMLInputElement>(null);
  const bpm = Number.parseFloat(text);
  const valid = isValidBpm(bpm);

  const applyTempo = () => {
    if (!valid) return;
    const duration = useAudioStore.getState().duration;
    const grid = manualGrid({ bpm, beatsPerBar: Number(meter), anchor: livePlaybackTime() }, duration);
    useProjectStore.getState().applyBeatGridWithHistory(grid);
    const detection = useBeatDetectionStore.getState();
    if (detection.status === "error") detection.dismiss();
    onDone();
  };

  const tap = () => {
    const next = tapTempo(taps ?? EMPTY_TAPS, performance.now());
    setTaps(next);
    if (next.bpm !== null) setText(formatBpm(next.bpm));
  };

  const tapOnShortcut = (e: React.KeyboardEvent) => {
    if (isTypingTarget(e.target) || !matchesShortcutBinding(e.nativeEvent, "sync.tap")) return;
    e.preventDefault();
    e.stopPropagation();
    if (!e.repeat) tap();
  };

  const typeIntoField = (e: React.KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey || e.altKey || e.key.length !== 1) return;
    if (matchesShortcutBinding(e.nativeEvent, "sync.tap")) return;
    const typed = sanitizeBpmInput(e.key);
    if (typed === "") return;
    e.preventDefault();
    flushSync(() => {
      setText(typed);
      setTaps(null);
    });
    fieldRef.current?.focus();
    fieldRef.current?.setSelectionRange(typed.length, typed.length);
  };

  return (
    <div onKeyDown={tapOnShortcut}>
      <PopHead title="Set tempo" onBack={onDone} />
      <div className={cn("grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-2 mt-2.5 p-2.5", DISPLAY_SURFACE)}>
        <span className="justify-self-start flex items-baseline gap-1.5 -mx-1 -my-[3px] px-1 py-[3px] rounded-md transition-[background-color,box-shadow] duration-150 hover:bg-(--layer-1) focus-within:shadow-[inset_0_0_0_1px_var(--lit-ring)]">
          <input
            ref={fieldRef}
            value={text}
            onChange={(e) => {
              setText(sanitizeBpmInput(e.target.value));
              setTaps(null);
            }}
            onKeyDown={(e) => {
              if (matchesShortcutBinding(e.nativeEvent, "global.playPauseWhileTyping")) return;
              e.stopPropagation();
              if (e.key !== "Enter") return;
              e.preventDefault();
              applyTempo();
            }}
            inputMode="decimal"
            maxLength={5}
            aria-label="Tempo in BPM"
            style={{ width: `${Math.max(MIN_FIELD_CH, text.length)}ch` }}
            className={cn(
              BPM_NUMBER_CLASS,
              "p-0 border-0 outline-none bg-transparent caret-composer-accent cursor-text select-text",
            )}
          />
          <span className="text-xs leading-[1.3] font-medium text-(--on-display-dim)">BPM</span>
        </span>
        <TapKey onTap={tap} onKeyDown={typeIntoField} className="col-start-2 row-start-1 row-span-2 self-center" />
        <span className="flex items-center gap-2.5 min-w-0">
          <StaticLeds lit={taps ? Math.min(taps.taps.length, TAPS_FOR_TEMPO) : 0} />
          <span className="text-[12.5px] leading-[1.2] text-(--muted) whitespace-nowrap" aria-live="polite">
            {tapStatus(taps)}
          </span>
        </span>
      </div>
      <PopGroup>
        <PopRow label="Beats per bar">
          <SegmentedControl
            size="sm"
            aria-label="Beats per bar"
            value={meter}
            options={METER_OPTIONS}
            onChange={setMeter}
          />
        </PopRow>
        <PopRow label="Bar 1">
          <PlayheadTime />
        </PopRow>
      </PopGroup>
      <PopActions className="mt-4">
        <PopButton onClick={onDone}>Cancel</PopButton>
        <PopButton variant="primary" disabled={!valid} onClick={applyTempo}>
          {valid ? `Use ${bpm} BPM` : "Use tempo"}
        </PopButton>
      </PopActions>
    </div>
  );
};

// -- Exports -------------------------------------------------------------------

export { SetTempoView };
