function bindAudioStateEvents(
  audio: HTMLAudioElement,
  getIsPlaying: () => boolean,
  setIsPlaying: (isPlaying: boolean) => void,
): () => void {
  // Media events arrive as queued tasks, so a later play() or pause() may already have reversed them.
  const handlePlay = () => {
    if (audio.paused || getIsPlaying()) return;
    setIsPlaying(true);
  };
  const handlePause = () => {
    if (!audio.paused || !getIsPlaying()) return;
    setIsPlaying(false);
  };
  audio.addEventListener("play", handlePlay);
  audio.addEventListener("pause", handlePause);
  return () => {
    audio.removeEventListener("play", handlePlay);
    audio.removeEventListener("pause", handlePause);
  };
}

export { bindAudioStateEvents };
