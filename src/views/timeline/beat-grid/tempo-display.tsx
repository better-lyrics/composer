import { type BeatGrid, barNumberAt, beatInBar, isDownbeat } from "@/domain/tempo/beat-grid";
import { tempoSections } from "@/domain/tempo/tempo-sections";
import type { TempoStats } from "@/domain/tempo/tempo-stats";
import { Tooltip } from "@/ui/tooltip";
import { cn } from "@/utils/cn";
import { formatBpm } from "@/utils/format-bpm";
import { pluralize } from "@/utils/pluralize";
import { usePlayheadBeat } from "@/views/timeline/beat-grid/use-playhead-beat";
import { usePlayheadTempo } from "@/views/timeline/beat-grid/use-playhead-tempo";
import { useRef } from "react";

// -- Types ---------------------------------------------------------------------

interface TempoFact {
  id: string;
  text: string;
}

// -- Constants -----------------------------------------------------------------

const MAX_LEDS = 8;
const DISPLAY_SURFACE = "rounded-lg bg-(--display) shadow-(--well-edge)";
const LED_CLASS =
  "w-4 h-1 rounded-[2px] bg-[color-mix(in_oklab,var(--ink)_10%,transparent)] transition-colors duration-180 ease-[cubic-bezier(0.22,1,0.36,1)] data-on:bg-composer-accent data-on:duration-0 data-down:bg-composer-accent-text";
const BPM_NUMBER_CLASS =
  "font-mono text-[30px] font-semibold leading-none tracking-[-0.02em] tabular-nums text-(--on-display)";

// -- Helpers -------------------------------------------------------------------

function tempoDescription(grid: BeatGrid, stats: TempoStats): string {
  const sections = tempoSections(grid);
  if (sections.length === 2) return `${sections.map((section) => formatBpm(section.bpm)).join(" → ")} BPM`;
  if (sections.length > 2) return `${sections.length} tempos`;
  return stats.steady ? "steady tempo" : `drifts ${formatBpm(stats.low)} to ${formatBpm(stats.high)}`;
}

function tempoChanges(grid: BeatGrid): TempoFact[] {
  const sections = tempoSections(grid);
  if (sections.length < 2) return [];
  return sections.map((section) => ({
    id: String(section.from),
    text: `${formatBpm(section.bpm)} BPM from bar ${Math.max(1, barNumberAt(grid, section.from))}`,
  }));
}

function tempoFacts(grid: BeatGrid, stats: TempoStats): TempoFact[] {
  const meter = { id: "meter", text: `${grid.beatsPerBar}/4` };
  if (grid.source === "manual") return [meter, { id: "manual", text: "set by hand" }];
  return [
    meter,
    { id: "bars", text: pluralize(stats.bars, "bar") },
    { id: "tempo", text: tempoDescription(grid, stats) },
  ];
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
    const lit = index >= 0 ? Math.min(beatInBar(grid, index), count - 1) : -1;
    const down = index >= 0 && isDownbeat(grid, index);
    Array.from(strip.children).forEach((led, position) => {
      led.toggleAttribute("data-on", position === lit);
      led.toggleAttribute("data-down", position === lit && down);
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

const TempoChangesFact: React.FC<{ fact: string; changes: TempoFact[] }> = ({ fact, changes }) => (
  <Tooltip
    placement="bottom"
    content={changes.map((change) => (
      <span key={change.id} className="block">
        {change.text}
      </span>
    ))}
  >
    {/* biome-ignore lint/a11y/noNoninteractiveTabindex: focus opens the tooltip that says where the tempo changes */}
    <span tabIndex={0} className="whitespace-nowrap cursor-help underline decoration-dotted underline-offset-2">
      {fact}
    </span>
  </Tooltip>
);

const TempoDisplay: React.FC<{ grid: BeatGrid; stats: TempoStats }> = ({ grid, stats }) => {
  const [meter, ...rest] = tempoFacts(grid, stats);
  const bpm = usePlayheadTempo(grid, "beat-grid-display-tempo", stats.bpm);
  const changes = grid.source === "manual" ? [] : tempoChanges(grid);
  return (
    <div
      className={cn(
        "grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-2.5 mt-2.5 py-3.5 pr-3.5 pl-2.5",
        DISPLAY_SURFACE,
      )}
    >
      <span className="row-span-2 flex items-baseline gap-1.5">
        <b className={cn(BPM_NUMBER_CLASS, "select-text cursor-text")}>{bpm}</b>
        <span className="text-xs leading-[1.3] font-medium text-(--on-display-dim)">BPM</span>
      </span>
      <span className="flex flex-wrap gap-x-5 gap-y-1 overflow-x-clip text-[12.5px] leading-[1.3] text-(--muted)">
        <b className="font-medium tabular-nums text-(--label) whitespace-nowrap">{meter.text}</b>
        {rest.map((fact, i) => (
          <span key={fact.id} className="-ml-5 whitespace-nowrap">
            <span aria-hidden="true" className="inline-block w-5 text-center">
              ・
            </span>
            {i === rest.length - 1 && changes.length > 0 ? (
              <TempoChangesFact fact={fact.text} changes={changes} />
            ) : (
              fact.text
            )}
          </span>
        ))}
      </span>
      <BeatLeds grid={grid} />
    </div>
  );
};

// -- Exports -------------------------------------------------------------------

export { BPM_NUMBER_CLASS, DISPLAY_SURFACE, StaticLeds, TempoDisplay };
