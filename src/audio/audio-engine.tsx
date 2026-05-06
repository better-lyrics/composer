import { useAudioStore } from "@/stores/audio";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

// -- Constants -----------------------------------------------------------------

const LOG_PREFIX = "[AudioEngine]";
const TUNNEL_RETRY_DEBOUNCE_MS = 5000;

// -- Component -----------------------------------------------------------------

const AudioEngine: React.FC = () => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const lastTunnelErrorAtRef = useRef(0);

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
    if (!source) {
      registerAudioElement(null);
      return;
    }

    let audioSrc: string;
    let createdObjectUrl: string | null = null;

    if (source.type === "file") {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      createdObjectUrl = URL.createObjectURL(source.file);
      objectUrlRef.current = createdObjectUrl;
      audioSrc = createdObjectUrl;
    } else if (source.type === "youtube") {
      if (!source.tunnelUrl) {
        registerAudioElement(null);
        return;
      }
      audioSrc = source.tunnelUrl;
    } else {
      registerAudioElement(null);
      return;
    }

    const audio = new Audio();
    audio.id = "composer-audio";
    if (source.type === "youtube") audio.crossOrigin = "anonymous";
    audio.src = audioSrc;
    audio.style.display = "none";
    document.body.appendChild(audio);
    audioRef.current = audio;
    registerAudioElement(audio);

    const handleLoadedMetadata = () => setDuration(audio.duration);
    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleEnded = () => setIsPlaying(false);
    const handleError = (e: Event) => {
      console.error(LOG_PREFIX, "Audio error:", e);
      const current = useAudioStore.getState().source;
      if (current?.type !== "youtube") return;
      const now = Date.now();
      if (now - lastTunnelErrorAtRef.current < TUNNEL_RETRY_DEBOUNCE_MS) {
        toast.error("Audio unavailable, try again later");
        useAudioStore.getState().setSource(null);
        lastTunnelErrorAtRef.current = 0;
        return;
      }
      lastTunnelErrorAtRef.current = now;
      useAudioStore.getState().setYouTubeSource(current.videoId);
    };

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
      if (createdObjectUrl && objectUrlRef.current === createdObjectUrl) {
        URL.revokeObjectURL(createdObjectUrl);
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
