import { DeckKnob } from "@/audio/deck/deck-knob";
import { NORMAL_PLAYBACK_RATE, useAudioStore } from "@/stores/audio";
import { useSettingsStore } from "@/stores/settings";
import { Button } from "@/ui/button";
import { Slider } from "@/ui/slider";
import { Switch } from "@/ui/switch";

// -- Constants ----------------------------------------------------------------

const RATE_PRESETS = [0.5, 0.75, 1, 1.25, 1.5, 2];
const RATE_MIN = 0.25;
const RATE_MAX = 2;
const RATE_STEP = 0.05;

// -- Helpers ------------------------------------------------------------------

function roundedRate(rate: number): number {
  const stepped = Math.round(rate / RATE_STEP) * RATE_STEP;
  return Math.round(Math.min(RATE_MAX, Math.max(RATE_MIN, stepped)) * 100) / 100;
}

// -- Component ----------------------------------------------------------------

const RateKnob: React.FC = () => {
  const rate = useAudioStore((state) => state.playbackRate);
  const setPlaybackRate = useAudioStore((state) => state.setPlaybackRate);
  const preservePitch = useSettingsStore((state) => state.preservePitch);
  const setSetting = useSettingsStore((state) => state.set);

  return (
    <DeckKnob
      label="Rate"
      valueText={`${rate.toFixed(2)}×`}
      fraction={(rate - RATE_MIN) / (RATE_MAX - RATE_MIN)}
      onFraction={(fraction) => setPlaybackRate(roundedRate(RATE_MIN + fraction * (RATE_MAX - RATE_MIN)))}
      onStep={(direction) => setPlaybackRate(roundedRate(rate + direction * RATE_STEP))}
      onReset={() => setPlaybackRate(NORMAL_PLAYBACK_RATE)}
      rememberValue={() => {
        const { playbackRate, otherPlaybackRate, restorePlaybackRates } = useAudioStore.getState();
        return () => restorePlaybackRates({ playbackRate, otherPlaybackRate });
      }}
    >
      <div className="p-3">
        <div className="flex gap-1 mb-3">
          {RATE_PRESETS.map((preset) => (
            <Button
              key={preset}
              size="sm"
              variant={rate === preset ? "primary" : "secondary"}
              onClick={() => setPlaybackRate(preset)}
              className="font-mono"
            >
              {preset}x
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs text-composer-text-muted">{RATE_MIN}x</span>
          <Slider
            value={rate}
            min={RATE_MIN}
            max={RATE_MAX}
            step={RATE_STEP}
            onChange={(value) => setPlaybackRate(Math.round(value * 100) / 100)}
            aria-label="Playback rate"
            className="w-full"
          />
          <span className="font-mono text-xs text-composer-text-muted">{RATE_MAX}x</span>
        </div>
        <div className="flex items-center justify-between gap-2.5 mt-3 pt-3 border-t border-(--divider)">
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="text-sm text-composer-text">Preserve pitch</span>
            <span className="text-xs text-composer-text-muted">Keeps pitch steady when speed changes.</span>
          </div>
          <Switch
            checked={preservePitch}
            label="Preserve pitch"
            onCheckedChange={(value) => setSetting("preservePitch", value)}
          />
        </div>
      </div>
    </DeckKnob>
  );
};

// -- Exports ------------------------------------------------------------------

export { RateKnob };
