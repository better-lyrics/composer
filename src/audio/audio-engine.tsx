import { useAudioStore } from "@/stores/audio";
import { useEffect, useRef } from "react";

// -- Constants -----------------------------------------------------------------

const SAMPLES_PER_PIXEL = 100;

// -- Component -----------------------------------------------------------------

const AudioEngine: React.FC = () => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  const source = useAudioStore((s) => s.source);
  const isPlaying = useAudioStore((s) => s.isPlaying);
  const playbackRate = useAudioStore((s) => s.playbackRate);
  const setCurrentTime = useAudioStore((s) => s.setCurrentTime);
  const setDuration = useAudioStore((s) => s.setDuration);
  const setIsPlaying = useAudioStore((s) => s.setIsPlaying);
  const registerAudioElement = useAudioStore((s) => s.registerAudioElement);
  const setWaveformData = useAudioStore((s) => s.setWaveformData);

  // Create audio element and decode waveform when source changes
  useEffect(() => {
    if (!source || source.type !== "file") {
      registerAudioElement(null);
      setWaveformData(null);
      return;
    }

    // Revoke previous object URL
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
    }

    const objectUrl = URL.createObjectURL(source.file);
    objectUrlRef.current = objectUrl;

    const audio = new Audio();
    audio.src = objectUrl;
    audioRef.current = audio;
    registerAudioElement(audio);

    audio.addEventListener("loadedmetadata", () => {
      setDuration(audio.duration);
    });

    audio.addEventListener("timeupdate", () => {
      setCurrentTime(audio.currentTime);
    });

    audio.addEventListener("ended", () => {
      setIsPlaying(false);
    });

    // Decode audio for waveform
    const audioContext = new AudioContext();
    audioContextRef.current = audioContext;

    source.file.arrayBuffer().then((arrayBuffer) => {
      audioContext.decodeAudioData(arrayBuffer).then((audioBuffer) => {
        const channelData = audioBuffer.getChannelData(0);
        const samples: number[] = [];
        const step = Math.floor(channelData.length / (audioBuffer.duration * SAMPLES_PER_PIXEL));

        for (let i = 0; i < channelData.length; i += step) {
          let sum = 0;
          const count = Math.min(step, channelData.length - i);
          for (let j = 0; j < count; j++) {
            sum += Math.abs(channelData[i + j]);
          }
          samples.push(sum / count);
        }

        // Normalize
        const max = Math.max(...samples);
        const normalized = samples.map((s) => s / max);
        setWaveformData(normalized);
      });
    });

    return () => {
      audio.pause();
      audio.src = "";
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
      audioContext.close();
      registerAudioElement(null);
    };
  }, [source, setDuration, setCurrentTime, setIsPlaying, registerAudioElement, setWaveformData]);

  // Sync playback state
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.play();
    } else {
      audio.pause();
    }
  }, [isPlaying]);

  // Sync playback rate
  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  return null;
};

// -- Exports -------------------------------------------------------------------

export { AudioEngine, SAMPLES_PER_PIXEL };
