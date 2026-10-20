import { Button } from "@/ui/button";
import { cn } from "@/utils/cn";
import { formatTime } from "@/utils/format-time";
import { pluralize } from "@/utils/pluralize";
import { LoopToggle } from "@/views/timeline/loop-toggle";
import { stopSelectionPlayback } from "@/views/timeline/selection-playback";
import { STRIP_CONTROL } from "@/views/timeline/strip-control";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { useSelectionPlaybackRange } from "@/views/timeline/use-selection-playback-range";
import { IconPlayerPlay } from "@tabler/icons-react";

// -- Components ----------------------------------------------------------------

const SelectionPlaybackBar: React.FC = () => {
  const playback = useSelectionPlaybackRange();
  const wordCount = useTimelineStore((s) => s.selectedWords.length);
  if (!playback) return null;

  return (
    <div
      data-selection-playback-bar
      role="group"
      aria-label="Playing selection"
      className="flex h-10 shrink-0 select-none items-center gap-3 border-b border-composer-border bg-[color-mix(in_srgb,var(--color-composer-accent)_7%,var(--color-composer-bg-dark))] pl-3 pr-2 text-xs"
    >
      <span className="flex items-center gap-1.5 font-semibold text-composer-text">
        <IconPlayerPlay aria-hidden="true" className="size-3.5" />
        {pluralize(wordCount, "word")}
      </span>
      <span className="select-text cursor-text tabular-nums text-composer-text-muted">
        {`${formatTime(playback.selection.begin, 2)} to ${formatTime(playback.selection.end, 2)}`}
      </span>
      <span className="flex-1" />
      <LoopToggle />
      <Button size="sm" className={cn(STRIP_CONTROL, "px-2.5")} onClick={() => stopSelectionPlayback({ pause: true })}>
        Stop
      </Button>
    </div>
  );
};

// -- Exports -------------------------------------------------------------------

export { SelectionPlaybackBar };
