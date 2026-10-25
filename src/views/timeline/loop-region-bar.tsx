import { useAudioStore } from "@/stores/audio";
import { Button } from "@/ui/button";
import { InlineKeyBadge } from "@/ui/inline-key-badge";
import { SingerTag } from "@/ui/singer-tag";
import { loopRegionLengthLabel, loopRegionRangeLabel } from "@/views/timeline/loop-region-copy";
import { LoopToggle } from "@/views/timeline/loop-toggle";
import { clearLoopRegion, playLoopRegion, stopSelectionPlayback } from "@/views/timeline/selection-playback";
import { selectionPlaybackIcon } from "@/views/timeline/selection-playback-icon";
import { STRIP_BAR, STRIP_TAG, stripTint } from "@/views/timeline/strip-control";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { IconBracketsContain, IconPlayerPlayFilled, IconPlayerStopFilled } from "@tabler/icons-react";

// -- Constants -----------------------------------------------------------------

const ACCENT = "var(--color-composer-accent)";

// -- Components ----------------------------------------------------------------

const LoopRegionBar: React.FC = () => {
  const region = useTimelineStore((s) => s.loopRegion);
  const mode = useTimelineStore((s) => s.selectionPlayback);
  const isPlaying = useAudioStore((s) => s.isPlaying);
  if (!region) return null;
  const playingMode = isPlaying ? mode : null;
  const TagIcon = playingMode ? selectionPlaybackIcon(playingMode) : IconBracketsContain;

  return (
    <div data-loop-region-bar role="group" aria-label="Loop region" className={STRIP_BAR} style={stripTint(ACCENT)}>
      <SingerTag color={ACCENT} className={STRIP_TAG}>
        <span className="flex items-center gap-1.5">
          <TagIcon aria-hidden="true" className="size-3.5" />
          Region
        </span>
      </SingerTag>
      <span className="select-text cursor-text pl-1 tabular-nums text-composer-text-muted">
        {loopRegionRangeLabel(region)}
        <span className="text-composer-text-faint">{` ・ ${loopRegionLengthLabel(region)}`}</span>
      </span>
      <span className="flex-1" />
      {playingMode ? (
        <Button size="lg" hasIcon className="shrink-0" onClick={() => stopSelectionPlayback({ pause: true })}>
          <IconPlayerStopFilled aria-hidden="true" className="size-4" />
          Stop
        </Button>
      ) : (
        <Button size="lg" hasIcon className="shrink-0" onClick={() => playLoopRegion(region.loops ? "loop" : "once")}>
          <IconPlayerPlayFilled aria-hidden="true" className="size-4" />
          Play
        </Button>
      )}
      <LoopToggle />
      <Button size="lg" className="shrink-0" onClick={clearLoopRegion}>
        Clear
        <InlineKeyBadge keys={["Esc"]} />
      </Button>
    </div>
  );
};

// -- Exports -------------------------------------------------------------------

export { LoopRegionBar };
