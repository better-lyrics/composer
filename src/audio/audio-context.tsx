import { useAudioStore } from "@/stores/audio";
import { createContext, useCallback, useContext, useEffect, useRef } from "react";
import type WaveSurfer from "wavesurfer.js";

interface AudioContextValue {
	wavesurferRef: React.MutableRefObject<WaveSurfer | null>;
	seek: (time: number) => void;
}

const AudioContext = createContext<AudioContextValue | null>(null);

const AudioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
	const wavesurferRef = useRef<WaveSurfer | null>(null);

	const isPlaying = useAudioStore((s) => s.isPlaying);
	const playbackRate = useAudioStore((s) => s.playbackRate);

	const seek = useCallback((time: number) => {
		const ws = wavesurferRef.current;
		if (ws) {
			const duration = ws.getDuration();
			if (duration > 0) {
				ws.seekTo(time / duration);
			}
		}
	}, []);

	useEffect(() => {
		const ws = wavesurferRef.current;
		if (!ws) return;

		if (isPlaying && !ws.isPlaying()) {
			ws.play();
		} else if (!isPlaying && ws.isPlaying()) {
			ws.pause();
		}
	}, [isPlaying]);

	useEffect(() => {
		const ws = wavesurferRef.current;
		if (ws) {
			ws.setPlaybackRate(playbackRate);
		}
	}, [playbackRate]);

	return <AudioContext.Provider value={{ wavesurferRef, seek }}>{children}</AudioContext.Provider>;
};

function useAudioContext() {
	const context = useContext(AudioContext);
	if (!context) {
		throw new Error("useAudioContext must be used within AudioProvider");
	}
	return context;
}

export { AudioProvider, useAudioContext };
