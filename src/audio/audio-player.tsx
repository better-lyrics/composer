import { useAudioStore } from "@/stores/audio";
import { Button } from "@/ui/button";
import { Popover } from "@/ui/popover";
import { Slider } from "@/ui/slider";
import { IconPlayerPauseFilled, IconPlayerPlayFilled, IconVolume, IconVolume2, IconVolume3 } from "@tabler/icons-react";
import { useCallback } from "react";

// -- Helpers ------------------------------------------------------------------

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds)) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

// -- Components ---------------------------------------------------------------

const PlayButton: React.FC<{ isPlaying: boolean; onClick: () => void }> = ({ isPlaying, onClick }) => (
  <Button onClick={onClick} className="w-10 h-10 rounded-full" aria-label={isPlaying ? "Pause" : "Play"}>
    {isPlaying ? <IconPlayerPauseFilled className="w-5 h-5" /> : <IconPlayerPlayFilled className="w-5 h-5" />}
  </Button>
);

const TimeDisplay: React.FC<{ current: number; duration: number }> = ({ current, duration }) => (
  <span className="font-mono text-sm select-text text-composer-text-secondary tabular-nums">
    {formatTime(current)} / {formatTime(duration)}
  </span>
);

const RATE_PRESETS = [0.5, 0.75, 1, 1.25, 1.5, 2];
const RATE_MIN = 0.25;
const RATE_MAX = 2;
const RATE_STEP = 0.05;

const PlaybackRateControl: React.FC<{
  rate: number;
  onChangeRate: (rate: number) => void;
}> = ({ rate, onChangeRate }) => {
  const handleSliderChange = useCallback(
    (value: number) => {
      onChangeRate(Math.round(value * 100) / 100);
    },
    [onChangeRate],
  );

  const displayRate = rate.toFixed(2);

  return (
    <Popover
      placement="top-end"
      trigger={
        <Button variant="ghost" className="font-mono tabular-nums min-w-12">
          {displayRate}x
        </Button>
      }
    >
      <div className="p-3">
        <div className="flex gap-1 mb-3">
          {RATE_PRESETS.map((preset) => (
            <Button
              key={preset}
              size="sm"
              variant={rate === preset ? "primary" : "secondary"}
              onClick={() => onChangeRate(preset)}
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
            onChange={handleSliderChange}
            aria-label="Playback rate"
            className="w-full"
          />
          <span className="font-mono text-xs text-composer-text-muted">{RATE_MAX}x</span>
        </div>
      </div>
    </Popover>
  );
};

const VolumeControl: React.FC<{
  volume: number;
  isMuted: boolean;
  onChangeVolume: (volume: number) => void;
  onToggleMute: () => void;
}> = ({ volume, isMuted, onChangeVolume, onToggleMute }) => {
  const getVolumeIcon = () => {
    if (isMuted || volume === 0) return IconVolume3;
    if (volume < 0.5) return IconVolume2;
    return IconVolume;
  };

  const VolumeIcon = getVolumeIcon();
  const displayVolume = Math.round((isMuted ? 0 : volume) * 100);

  return (
    <Popover
      placement="top-end"
      trigger={
        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Volume">
          <VolumeIcon className="w-4 h-4" />
        </Button>
      }
    >
      <div className="p-3 w-40">
        <div className="flex items-center gap-2 mb-2 justify-between pr-2.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            onClick={onToggleMute}
            aria-label={isMuted ? "Unmute" : "Mute"}
          >
            <VolumeIcon className="w-4 h-4" />
          </Button>
          <span className="text-xs text-composer-text-muted tabular-nums w-8 text-right">{displayVolume}%</span>
        </div>
        <Slider
          value={isMuted ? 0 : volume}
          min={0}
          max={1}
          step={0.01}
          onChange={onChangeVolume}
          aria-label="Volume"
          className="w-full"
        />
      </div>
    </Popover>
  );
};

const AudioPlayer: React.FC = () => {
  const source = useAudioStore((s) => s.source);
  const seekTo = useAudioStore((s) => s.seekTo);
  const isPlaying = useAudioStore((s) => s.isPlaying);
  const currentTime = useAudioStore((s) => s.currentTime);
  const duration = useAudioStore((s) => s.duration);
  const playbackRate = useAudioStore((s) => s.playbackRate);
  const volume = useAudioStore((s) => s.volume);
  const isMuted = useAudioStore((s) => s.isMuted);
  const setIsPlaying = useAudioStore((s) => s.setIsPlaying);
  const setPlaybackRate = useAudioStore((s) => s.setPlaybackRate);
  const setVolume = useAudioStore((s) => s.setVolume);
  const toggleMute = useAudioStore((s) => s.toggleMute);

  if (!source) return null;

  return (
    <div className="flex items-center gap-4 p-4 border-t select-none border-composer-border bg-composer-bg-dark">
      <PlayButton isPlaying={isPlaying} onClick={() => setIsPlaying(!isPlaying)} />
      <Slider
        value={currentTime}
        min={0}
        max={duration}
        onChange={seekTo}
        aria-label="Audio progress"
        className="flex-1"
      />
      <TimeDisplay current={currentTime} duration={duration} />
      <VolumeControl volume={volume} isMuted={isMuted} onChangeVolume={setVolume} onToggleMute={toggleMute} />
      <PlaybackRateControl rate={playbackRate} onChangeRate={setPlaybackRate} />
    </div>
  );
};

// -- Exports ------------------------------------------------------------------

export { AudioPlayer, formatTime };
