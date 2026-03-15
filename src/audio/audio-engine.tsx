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
    audio.id = "composer-audio";
    audio.src = objectUrl;
    audio.style.display = "none";
    document.body.appendChild(audio);
    audioRef.current = audio;
    registerAudioElement(audio);

    const handleLoadedMetadata = () => setDuration(audio.duration);
    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleEnded = () => setIsPlaying(false);
    const handleError = (e: Event) => console.error(LOG_PREFIX, "Audio error:", e);

    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("error", handleError);

    return () => {
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("error", handleError);
      audio.pause();
      audio.src = "";
      audio.remove();
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
    if (!audio) return;
    audio.playbackRate = playbackRate;
    audio.volume = volume;
    audio.muted = isMuted;
  }, [playbackRate, volume, isMuted]);

  return null;
};

// -- Exports -------------------------------------------------------------------

export { AudioEngine };
