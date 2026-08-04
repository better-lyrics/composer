import "@braccato/core/element";
import type { BraccatoLyricsElement, LineClickDetail } from "@braccato/core/element";
import { TTMLParser } from "@braccato/parsers";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useRendererAudioSync } from "@/hooks/use-renderer-audio-sync";
import { useAudioStore } from "@/stores/audio";

// -- Interfaces ---------------------------------------------------------------

interface BraccatoRendererProps {
  ttmlString: string;
  durationSeconds: number;
}

// -- Helpers ------------------------------------------------------------------

function handleBraccatoLineClick(e: Event): void {
  const detail = (e as CustomEvent<LineClickDetail>).detail;
  if (detail?.timeS == null) return;
  const audio = useAudioStore.getState();
  audio.seekTo(detail.timeS);
  audio.setIsPlaying(true);
}

// -- Component ----------------------------------------------------------------

const BraccatoRenderer: React.FC<BraccatoRendererProps> = ({ ttmlString, durationSeconds }) => {
  const elementRef = useRef<BraccatoLyricsElement>(null);
  const lyrics = useMemo(() => TTMLParser.parse(ttmlString, durationSeconds * 1000), [ttmlString, durationSeconds]);

  const setElement = useCallback((el: BraccatoLyricsElement | null) => {
    elementRef.current = el;
    if (!el) return;
    el.addEventListener("braccato:line-click", handleBraccatoLineClick);
    return () => {
      el.removeEventListener("braccato:line-click", handleBraccatoLineClick);
      elementRef.current = null;
    };
  }, []);

  useEffect(() => {
    const element = elementRef.current;
    if (element) element.lyrics = lyrics;
  }, [lyrics]);

  // No `source` is bound on purpose. A bound media element makes braccato own the
  // clock, and it only polls while playback runs, which would freeze the preview
  // whenever the user scrubs the timeline paused.
  useRendererAudioSync(elementRef, (el, audio) => {
    el.currentTime = audio.currentTime;
    el.playing = !audio.paused;
  });

  return <braccato-lyrics ref={setElement} className="block flex-1 mx-auto w-full max-w-3xl px-6 overflow-y-auto" />;
};

// -- Exports ------------------------------------------------------------------

export { BraccatoRenderer };
