import { type BeatGrid, beatInBar } from "@/domain/tempo/beat-grid";
import type { TempoStats } from "@/domain/tempo/tempo-stats";
import { cn } from "@/utils/cn";
import { formatBpm } from "@/utils/format-bpm";
import { pluralize } from "@/utils/pluralize";
import { usePlayheadBeat } from "@/views/timeline/beat-grid/use-playhead-beat";
import { Fragment, useRef } from "react";

// -- Constants -----------------------------------------------------------------

const MAX_LEDS = 8;
const DISPLAY_SURFACE = "rounded-lg bg-(--display) shadow-(--well-edge)";
const LED_CLASS =
  "w-4 h-1 rounded-[2px] bg-[color-mix(in_oklab,var(--ink)_10%,transparent)] transition-colors duration-180 ease-[cubic-bezier(0.22,1,0.36,1)] data-on:bg-composer-accent data-on:duration-0 data-down:bg-composer-accent-text";
const BPM_NUMBER_CLASS =
  "font-mono text-[30px] font-semibold leading-none tracking-[-0.02em] tabular-nums text-(--on-display)";

// -- Helpers -------------------------------------------------------------------

function tempoFacts(grid: BeatGrid, stats: TempoStats): string[] {
  const meter = `${grid.beatsPerBar}/4`;
  if (grid.source === "manual") return [meter, "set by hand"];
  const tempo = stats.steady ? "steady tempo" : `drifts ${formatBpm(stats.low)} to ${formatBpm(stats.high)}`;
  return [meter, pluralize(stats.bars, "bar"), tempo];
}

// -- Components ----------------------------------------------------------------

const StaticLeds: React.FC<{ lit: number }> = ({ lit }) => (
  <span aria-hidden="true" className="flex gap-1.5">
    {[0, 1, 2, 3].map((led) => (
      <span key={led} data-on={led < lit ? "" : undefined} className={LED_CLASS} />
    ))}
  </span>
);

const BeatLeds: React.FC<{ grid: BeatGrid }> = ({ grid }) => {
  const stripRef = useRef<HTMLSpanElement>(null);
  const count = Math.min(grid.beatsPerBar, MAX_LEDS);

  usePlayheadBeat(grid, "beat-grid-leds", (index, changed) => {
    const strip = stripRef.current;
    if (!strip || !changed) return;
    const lit = index >= 0 ? beatInBar(grid, index) % count : -1;
    Array.from(strip.children).forEach((led, position) => {
      led.toggleAttribute("data-on", position === lit);
      led.toggleAttribute("data-down", position === lit && lit === 0);
    });
  });

  return (
    <span ref={stripRef} aria-hidden="true" className="flex gap-1.5">
      {Array.from({ length: count }, (_, led) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: LEDs are a fixed, ordered strip
        <span key={led} className={LED_CLASS} />
      ))}
    </span>
  );
};

const TempoDisplay: React.FC<{ grid: BeatGrid; stats: TempoStats }> = ({ grid, stats }) => {
  const [meter, ...rest] = tempoFacts(grid, stats);
  return (
    <div
      className={cn(
        "grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-2.5 mt-2.5 py-3.5 pr-3.5 pl-2.5",
        DISPLAY_SURFACE,
      )}
    >
      <span className="row-span-2 flex items-baseline gap-1.5">
        <b className={cn(BPM_NUMBER_CLASS, "select-text cursor-text")}>{formatBpm(stats.bpm)}</b>
        <span className="text-xs leading-[1.3] font-medium text-(--on-display-dim)">BPM</span>
      </span>
      <span className="text-[12.5px] leading-[1.2] text-(--muted)">
        <b className="font-medium tabular-nums text-(--label) whitespace-nowrap">{meter}</b>
        {rest.map((fact) => (
          <Fragment key={fact}>
            {"\u00a0・ "}
            <span className="whitespace-nowrap">{fact}</span>
          </Fragment>
        ))}
      </span>
      <BeatLeds grid={grid} />
    </div>
  );
};

// -- Exports -------------------------------------------------------------------

export { BPM_NUMBER_CLASS, DISPLAY_SURFACE, StaticLeds, TempoDisplay };
