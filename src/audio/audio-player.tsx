import { useAudioContext } from "@/audio/audio-context";
import { useAudioStore } from "@/stores/audio";
import { Slider } from "@/ui/slider";
import { IconPlayerPauseFilled, IconPlayerPlayFilled } from "@tabler/icons-react";
import { useCallback, useEffect, useRef, useState } from "react";

// -- Helpers ------------------------------------------------------------------

function formatTime(seconds: number): string {
	if (!Number.isFinite(seconds)) return "0:00";
	const mins = Math.floor(seconds / 60);
	const secs = Math.floor(seconds % 60);
	return `${mins}:${secs.toString().padStart(2, "0")}`;
}

// -- Components ---------------------------------------------------------------

const PlayButton: React.FC<{ isPlaying: boolean; onClick: () => void }> = ({
	isPlaying,
	onClick,
}) => (
	<button
		type="button"
		onClick={onClick}
		className="flex items-center justify-center w-10 h-10 transition-colors rounded-full cursor-pointer bg-composer-button hover:bg-composer-button-hover"
		aria-label={isPlaying ? "Pause" : "Play"}
	>
		{isPlaying ? (
			<IconPlayerPauseFilled className="w-5 h-5" />
		) : (
			<IconPlayerPlayFilled className="w-5 h-5" />
		)}
	</button>
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
	const [isOpen, setIsOpen] = useState(false);
	const containerRef = useRef<HTMLDivElement>(null);

	const handleClickOutside = useCallback((e: MouseEvent) => {
		if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
			setIsOpen(false);
		}
	}, []);

	useEffect(() => {
		if (isOpen) {
			document.addEventListener("mousedown", handleClickOutside);
			return () => document.removeEventListener("mousedown", handleClickOutside);
		}
	}, [isOpen, handleClickOutside]);

	const handleSliderChange = useCallback(
		(value: number) => {
			onChangeRate(Math.round(value * 100) / 100);
		},
		[onChangeRate],
	);

	const displayRate = rate.toFixed(2);

	return (
		<div ref={containerRef} className="relative">
			<button
				type="button"
				onClick={() => setIsOpen(!isOpen)}
				className="px-2 py-1 font-mono text-sm text-right transition-colors rounded cursor-pointer text-composer-text-secondary hover:bg-composer-button tabular-nums min-w-12"
			>
				{displayRate}x
			</button>
			{isOpen && (
				<div className="absolute right-0 p-3 mb-2 border rounded-lg shadow-lg bottom-full bg-composer-bg-dark border-composer-border">
					<div className="flex gap-1 mb-3">
						{RATE_PRESETS.map((preset) => (
							<button
								key={preset}
								type="button"
								onClick={() => onChangeRate(preset)}
								className={`cursor-pointer px-2 py-1 text-xs rounded transition-colors font-mono ${
									rate === preset
										? "bg-composer-accent-dark text-white"
										: "bg-composer-button hover:bg-composer-button-hover text-composer-text-secondary"
								}`}
							>
								{preset}x
							</button>
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
			)}
		</div>
	);
};

const AudioPlayer: React.FC = () => {
	const { seek } = useAudioContext();

	const source = useAudioStore((s) => s.source);
	const isPlaying = useAudioStore((s) => s.isPlaying);
	const currentTime = useAudioStore((s) => s.currentTime);
	const duration = useAudioStore((s) => s.duration);
	const playbackRate = useAudioStore((s) => s.playbackRate);
	const setIsPlaying = useAudioStore((s) => s.setIsPlaying);
	const setPlaybackRate = useAudioStore((s) => s.setPlaybackRate);

	if (!source) return null;

	return (
		<div className="flex items-center gap-4 p-4 border-t select-none border-composer-border bg-composer-bg-dark">
			<PlayButton isPlaying={isPlaying} onClick={() => setIsPlaying(!isPlaying)} />
			<Slider
				value={currentTime}
				min={0}
				max={duration}
				onChange={seek}
				aria-label="Audio progress"
				className="flex-1"
			/>
			<TimeDisplay current={currentTime} duration={duration} />
			<PlaybackRateControl rate={playbackRate} onChangeRate={setPlaybackRate} />
		</div>
	);
};

// -- Exports ------------------------------------------------------------------

export { AudioPlayer, formatTime };
