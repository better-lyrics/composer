import { bindAudioStateEvents } from "@/audio/audio-state-events";
import { useAudioStore } from "@/stores/audio";
import { useEffect, useRef } from "react";

// -- Constants -----------------------------------------------------------------

const LOG_PREFIX = "[AudioEngine]";
const ANALYSER_FFT_SIZE = 2048;
const RMS_AUDIBLE_THRESHOLD = 0.005;
const FREEZE_SAFETY_MS = 3000;

// -- Component -----------------------------------------------------------------

const AudioEngine: React.FC = () => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const analyserBufferRef = useRef<Uint8Array | null>(null);

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

    const playableFile = source.type === "file" ? source.file : source.type === "youtube" ? source.file : null;
    if (!playableFile) {
      registerAudioElement(null);
      return;
    }

    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const createdObjectUrl = URL.createObjectURL(playableFile);
    objectUrlRef.current = createdObjectUrl;

    const audio = new Audio();
    audio.id = "composer-audio";
    audio.src = createdObjectUrl;
    const {
      playbackRate: initialPlaybackRate,
      volume: initialVolume,
      isMuted: initialIsMuted,
    } = useAudioStore.getState();
    audio.playbackRate = initialPlaybackRate;
    audio.volume = initialVolume;
    audio.muted = initialIsMuted;
    audio.style.display = "none";
    document.body.appendChild(audio);
    audioRef.current = audio;
    registerAudioElement(audio);

    let analyserAvailable = false;
    try {
      if (!ctxRef.current || ctxRef.current.state === "closed") {
        ctxRef.current = new AudioContext();
      }
      const ctx = ctxRef.current;
      const sourceNode = ctx.createMediaElementSource(audio);
      sourceNode.connect(ctx.destination);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = ANALYSER_FFT_SIZE;
      analyser.smoothingTimeConstant = 0;
      sourceNode.connect(analyser);
      sourceNodeRef.current = sourceNode;
      analyserRef.current = analyser;
      analyserBufferRef.current = new Uint8Array(analyser.fftSize);
      analyserAvailable = true;
    } catch (err) {
      console.warn(LOG_PREFIX, "analyser setup failed; seek freeze disabled", err);
      sourceNodeRef.current = null;
      analyserRef.current = null;
      analyserBufferRef.current = null;
    }

    let rafId: number | null = null;
    let safetyTimeoutId: number | null = null;

    const releaseFreeze = () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      if (safetyTimeoutId !== null) {
        window.clearTimeout(safetyTimeoutId);
        safetyTimeoutId = null;
      }
      const store = useAudioStore.getState();
      if (store.seekFreeze) store.setSeekFreeze(false);
      if (store.seekFreezeTarget !== null) store.setSeekFreezeTarget(null);
    };

    const tickRms = () => {
      const analyser = analyserRef.current;
      const data = analyserBufferRef.current;
      if (!analyser || !data) {
        rafId = null;
        return;
      }
      analyser.getByteTimeDomainData(data);
      let sumSq = 0;
      for (let i = 0; i < data.length; i++) {
        const v = (data[i] - 128) / 128;
        sumSq += v * v;
      }
      const rms = Math.sqrt(sumSq / data.length);
      if (rms >= RMS_AUDIBLE_THRESHOLD) {
        releaseFreeze();
        return;
      }
      rafId = requestAnimationFrame(tickRms);
    };

    const handleSeeking = () => {
      if (!analyserAvailable) return;
      const store = useAudioStore.getState();
      store.setSeekFreezeTarget(audio.currentTime);
      store.setSeekFreeze(true);
      if (rafId === null) rafId = requestAnimationFrame(tickRms);
      if (safetyTimeoutId !== null) window.clearTimeout(safetyTimeoutId);
      safetyTimeoutId = window.setTimeout(() => {
        safetyTimeoutId = null;
        releaseFreeze();
      }, FREEZE_SAFETY_MS);
    };

    const handlePauseFreeze = () => {
      releaseFreeze();
    };

    const handlePlayResume = () => {
      const ctx = ctxRef.current;
      if (ctx && ctx.state === "suspended") ctx.resume().catch(() => undefined);
    };

    const handleLoadedMetadata = () => setDuration(audio.duration);
    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleEnded = () => setIsPlaying(false);
    const handleError = (e: Event) => {
      console.error(LOG_PREFIX, "Audio error:", e);
    };

    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("error", handleError);
    audio.addEventListener("seeking", handleSeeking);
    audio.addEventListener("pause", handlePauseFreeze);
    audio.addEventListener("play", handlePlayResume);
    const unbindStateEvents = bindAudioStateEvents(audio, setIsPlaying);

    return () => {
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("error", handleError);
      audio.removeEventListener("seeking", handleSeeking);
      audio.removeEventListener("pause", handlePauseFreeze);
      audio.removeEventListener("play", handlePlayResume);
      unbindStateEvents();
      releaseFreeze();
      audio.pause();
      audio.src = "";
      audio.remove();
      try {
        analyserRef.current?.disconnect();
      } catch {
        // analyser may already be disconnected
      }
      try {
        sourceNodeRef.current?.disconnect();
      } catch {
        // source node may already be disconnected
      }
      analyserRef.current = null;
      sourceNodeRef.current = null;
      analyserBufferRef.current = null;
      if (objectUrlRef.current === createdObjectUrl) {
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
