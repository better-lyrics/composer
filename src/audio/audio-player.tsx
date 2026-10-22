import { MeterBridge } from "@/audio/deck/meter-bridge";
import { OverviewScrub } from "@/audio/deck/overview-scrub";
import { RateKnob } from "@/audio/deck/rate-knob";
import { StemModule } from "@/audio/deck/stem-module";
import { TimeReadout } from "@/audio/deck/time-readout";
import { VolumeKnob } from "@/audio/deck/volume-knob";
import { togglePlayback } from "@/lib/sync-count-in";
import { useAudioStore } from "@/stores/audio";
import { selectIsCountingIn, useSyncCountInStore } from "@/stores/sync-count-in";
import { Key } from "@/ui/key";
import { cn } from "@/utils/cn";
import { IconPlayerPauseFilled, IconPlayerPlayFilled } from "@tabler/icons-react";

// -- Constants ----------------------------------------------------------------

const MODULE_STYLES =
  "relative flex items-center gap-2.5 h-full px-3.5 first:pl-0 last:pr-0 [&+&]:before:absolute [&+&]:before:left-0 [&+&]:before:inset-y-[18px] [&+&]:before:w-px [&+&]:before:bg-(--divider)";

// -- Components ---------------------------------------------------------------

const DeckModule: React.FC<{ className?: string; children: React.ReactNode }> = ({ className, children }) => (
  <div className={cn(MODULE_STYLES, className)}>{children}</div>
);

const PlayKey: React.FC = () => {
  const isPlaying = useAudioStore((state) => state.isPlaying);
  const countingIn = useSyncCountInStore(selectIsCountingIn);
  const showsPause = isPlaying || countingIn;
  const Glyph = showsPause ? IconPlayerPauseFilled : IconPlayerPlayFilled;
  return (
    <Key size="lg" onClick={togglePlayback} aria-label={showsPause ? "Pause" : "Play"} className="w-[54px]">
      <Glyph aria-hidden="true" className={cn("size-5", showsPause && "text-composer-accent-text")} />
    </Key>
  );
};

const AudioPlayer: React.FC = () => {
  const hasSource = useAudioStore((state) => state.source !== null);
  if (!hasSource) return null;

  return (
    <div
      data-transport-deck
      className="grid grid-cols-[auto_auto_minmax(280px,1fr)_auto_auto_auto] items-center h-20 shrink-0 px-2 select-none"
    >
      <DeckModule>
        <PlayKey />
      </DeckModule>
      <DeckModule>
        <TimeReadout />
      </DeckModule>
      <DeckModule className="min-w-[280px]">
        <OverviewScrub />
      </DeckModule>
      <DeckModule className="max-[1279px]:hidden">
        <MeterBridge />
      </DeckModule>
      <DeckModule className="gap-3">
        <RateKnob />
        <VolumeKnob />
      </DeckModule>
      <DeckModule className="empty:hidden">
        <StemModule />
      </DeckModule>
    </div>
  );
};

// -- Exports ------------------------------------------------------------------

export { AudioPlayer };
