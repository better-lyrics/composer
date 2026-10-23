import { DeckKnob } from "@/audio/deck/deck-knob";
import { FULL_VOLUME, useAudioStore } from "@/stores/audio";
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
  const changeVolume = (next: number) => {
    if (useAudioStore.getState().isMuted) toggleMute();
    setVolume(next);
  };

  return (
    <DeckKnob
      label="Volume"
      valueText={isMuted ? "Muted" : `${percent}%`}
      fraction={shownVolume}
      onFraction={(fraction) => changeVolume(Math.round(fraction * 100) / 100)}
      onStep={(direction) => changeVolume(Math.round((shownVolume + direction * KNOB_STEP) * 100) / 100)}
      onReset={() => changeVolume(FULL_VOLUME)}
      rememberValue={() => {
        const before = useAudioStore.getState();
        return () => {
          setVolume(before.volume);
          if (useAudioStore.getState().isMuted !== before.isMuted) toggleMute();
        };
      }}
    >
      <div className="p-3 w-40">
        <div className="flex items-center justify-between gap-2 mb-2">
          <IconButton
            label={isMuted ? "Unmute" : "Mute"}
            icon={<VolumeIcon className="size-3.5" />}
            variant="ghost"
            className="size-7 shrink-0 -my-1.5 -ml-1.5"
            onClick={toggleMute}
          />
          <span className="text-xs leading-none text-composer-text-muted tabular-nums">{percent}%</span>
        </div>
        <Slider
          value={shownVolume}
          min={0}
          max={1}
          step={VOLUME_STEP}
          onChange={changeVolume}
          aria-label="Volume"
          className="w-full"
        />
      </div>
    </DeckKnob>
  );
};

// -- Exports ------------------------------------------------------------------

export { VolumeKnob };
