import { useAudioStore } from "@/stores/audio";
import { useEffect, useRef } from "react";

// -- Constants -----------------------------------------------------------------

const LOG_PREFIX = "[AudioEngine]";

// -- Component -----------------------------------------------------------------

const AudioEngine: React.FC = () => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  const source = useAudioStore((s) => s.source);
  const isPlaying = useAudioStore((s) => s.isPlaying);
  const playbackRate = useAudioStore((s) => s.playbackRate);
  const volume = useAudioStore((s) => s.volume);
  const isMuted = useAudioStore((s) => s.isMuted);
  const setCurrentTime = useAudioStore((s) => s.setCurrentTime);
  const setDuration = useAudioStore((s) => s.setDuration);
  const setIsPlaying = useAudioStore((s) => s.setIsPlaying);
  const registerAudioElement = useAudioStore((s) => s.registerAudioElement);

  useEffect(() => {
    if (!source || source.type !== "file") {
      registerAudioElement(null);
      return;
    }

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

    audio.addEventListener("error", (e) => {
      console.error(LOG_PREFIX, "Audio error:", e);
    });

    return () => {
      audio.pause();
      audio.src = "";
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
      registerAudioElement(null);
    };
  }, [source, setDuration, setCurrentTime, setIsPlaying, registerAudioElement]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.play();
    } else {
      audio.pause();
    }
  }, [isPlaying]);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.volume = volume;
    }
  }, [volume]);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.muted = isMuted;
    }
  }, [isMuted]);

  return null;
};

// -- Exports -------------------------------------------------------------------

export { AudioEngine };
