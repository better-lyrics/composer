import { Button } from "@/ui/button";
import { SingerTag } from "@/ui/singer-tag";
import { formatTime } from "@/utils/format-time";
import { pluralize } from "@/utils/pluralize";
import { LoopToggle } from "@/views/timeline/loop-toggle";
import { stopSelectionPlayback } from "@/views/timeline/selection-playback";
import { selectionPlaybackIcon } from "@/views/timeline/selection-playback-icon";
import { STRIP_BAR, STRIP_TAG, stripTint } from "@/views/timeline/strip-control";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { useSelectionPlaybackRange } from "@/views/timeline/use-selection-playback-range";

// -- Constants -----------------------------------------------------------------

const ACCENT = "var(--color-composer-accent)";

// -- Components ----------------------------------------------------------------

const SelectionPlaybackBar: React.FC = () => {
  const playback = useSelectionPlaybackRange();
  const wordCount = useTimelineStore((s) => s.selectedWords.length);
  const mode = useTimelineStore((s) => s.selectionPlayback);
  if (!playback || !mode) return null;
  const ModeIcon = selectionPlaybackIcon(mode);

  return (
    <div
      data-selection-playback-bar
      role="group"
      aria-label="Playing selection"
      className={STRIP_BAR}
      style={stripTint(ACCENT)}
    >
      <SingerTag color={ACCENT} className={STRIP_TAG}>
        <span className="flex items-center gap-1.5">
          <ModeIcon aria-hidden="true" className="size-3.5" />
          {pluralize(wordCount, "word")}
        </span>
      </SingerTag>
      <span className="select-text cursor-text pl-1 tabular-nums text-composer-text-muted">
        {`${formatTime(playback.selection.begin, 2)} to ${formatTime(playback.selection.end, 2)}`}
      </span>
      <span className="flex-1" />
      <LoopToggle />
      <Button size="lg" onClick={() => stopSelectionPlayback({ pause: true })}>
        Stop
      </Button>
    </div>
  );
};

// -- Exports -------------------------------------------------------------------

export { SelectionPlaybackBar };
