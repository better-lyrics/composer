import { DeckKnob } from "@/audio/deck/deck-knob";
import { useAudioStore } from "@/stores/audio";
import { IconButton } from "@/ui/icon-button";
import { Slider } from "@/ui/slider";
import { IconVolume, IconVolume2, IconVolume3 } from "@tabler/icons-react";

// -- Constants ----------------------------------------------------------------

const VOLUME_STEP = 0.01;
const KNOB_STEP = 0.05;

// -- Helpers ------------------------------------------------------------------

function volumeIcon(volume: number, isMuted: boolean) {
  if (isMuted || volume === 0) return IconVolume3;
  if (volume < 0.5) return IconVolume2;
  return IconVolume;
}

// -- Component ----------------------------------------------------------------

const VolumeKnob: React.FC = () => {
  const volume = useAudioStore((state) => state.volume);
  const isMuted = useAudioStore((state) => state.isMuted);
  const setVolume = useAudioStore((state) => state.setVolume);
  const toggleMute = useAudioStore((state) => state.toggleMute);
  const shownVolume = isMuted ? 0 : volume;
  const percent = Math.round(shownVolume * 100);
  const VolumeIcon = volumeIcon(volume, isMuted);

  return (
    <DeckKnob
      label="Volume"
      valueText={isMuted ? "Muted" : `${percent}%`}
      fraction={shownVolume}
      onFraction={(fraction) => setVolume(Math.round(fraction * 100) / 100)}
      onStep={(direction) => setVolume(Math.round((volume + direction * KNOB_STEP) * 100) / 100)}
    >
      <div className="p-3 w-40">
        <div className="flex items-center gap-2 mb-2 justify-between pr-2.5">
          <IconButton
            label={isMuted ? "Unmute" : "Mute"}
            icon={<VolumeIcon className="size-4" />}
            variant="ghost"
            className="size-7 shrink-0"
            onClick={toggleMute}
          />
          <span className="text-xs text-composer-text-muted tabular-nums w-8 text-right">{percent}%</span>
        </div>
        <Slider
          value={shownVolume}
          min={0}
          max={1}
          step={VOLUME_STEP}
          onChange={setVolume}
          aria-label="Volume"
          className="w-full"
        />
      </div>
    </DeckKnob>
  );
};

// -- Exports ------------------------------------------------------------------

export { VolumeKnob };
