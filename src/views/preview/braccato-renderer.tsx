import type { BraccatoLyricsElement, LineClickDetail } from "@braccato/core/element";
import { TTMLParser } from "@braccato/parsers";
import { IconArrowDown } from "@tabler/icons-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRendererAudioSync } from "@/hooks/use-renderer-audio-sync";
import { useAudioStore } from "@/stores/audio";
import { Button } from "@/ui/button";
import braccatoTheme from "@/views/preview/braccato-theme.css?raw";

// -- Interfaces ---------------------------------------------------------------

interface BraccatoRendererProps {
  ttmlString: string;
}

// -- Constants -----------------------------------------------------------------

const LOG_PREFIX = "[BraccatoRenderer]";

// -- Element registration -----------------------------------------------------

// Must stay dynamic: registering evaluates `class ... extends HTMLElement`, which
// has no HTMLElement during the vite-react-ssg prerender and fails the build.
let registerPromise: Promise<unknown> | null = null;
function ensureRegistered(): Promise<unknown> {
  registerPromise ??= import("@braccato/core/element").catch((error: unknown) => {
    console.error(LOG_PREFIX, "failed to register <braccato-lyrics>; preview will stay empty", error);
  });
  return registerPromise;
}

// -- Helpers ------------------------------------------------------------------

function handleBraccatoLineClick(e: Event): void {
  const detail = (e as CustomEvent<LineClickDetail>).detail;
  if (detail?.timeS == null) return;
  const audio = useAudioStore.getState();
  audio.seekTo(detail.timeS);
  audio.setIsPlaying(true);
}

function handleBraccatoScroll(e: Event): void {
  (e.currentTarget as BraccatoLyricsElement).renderer?.noteUserScroll();
}

// -- Component ----------------------------------------------------------------

const BraccatoRenderer: React.FC<BraccatoRendererProps> = ({ ttmlString }) => {
  const elementRef = useRef<BraccatoLyricsElement>(null);
  const lyrics = useMemo(() => TTMLParser.parse(ttmlString), [ttmlString]);
  const latestLyricsRef = useRef(lyrics);
  const [isAutoscrollPaused, setIsAutoscrollPaused] = useState(false);

  const setElement = useCallback((el: BraccatoLyricsElement | null) => {
    elementRef.current = el;
    if (!el) return;
    el.theme = braccatoTheme;
    el.host = { setResumeAffordanceVisible: setIsAutoscrollPaused };
    el.lyrics = latestLyricsRef.current;
    el.addEventListener("braccato:line-click", handleBraccatoLineClick);
    el.addEventListener("scroll", handleBraccatoScroll, { passive: true });
    return () => {
      el.removeEventListener("braccato:line-click", handleBraccatoLineClick);
      el.removeEventListener("scroll", handleBraccatoScroll);
      elementRef.current = null;
    };
  }, []);

  const resumeAutoscroll = useCallback(() => {
    elementRef.current?.renderer?.resumeAutoscroll();
  }, []);

  useEffect(() => {
    void ensureRegistered();
  }, []);

  useEffect(() => {
    latestLyricsRef.current = lyrics;
    const element = elementRef.current;
    if (element) element.lyrics = lyrics;
  }, [lyrics]);

  // Binding `source` would make braccato own the clock, and it only polls during
  // playback, freezing the preview whenever the timeline is scrubbed paused.
  useRendererAudioSync(elementRef, (el, audio) => {
    el.currentTime = audio.currentTime;
    el.playing = !audio.paused;
  });

  return (
    <div className="relative flex flex-col flex-1 min-h-0">
      <braccato-lyrics ref={setElement} className="block flex-1 mx-auto w-full max-w-3xl px-6" />
      {isAutoscrollPaused ? (
        <Button
          variant="secondary"
          hasIcon
          onClick={resumeAutoscroll}
          className="absolute bottom-6 left-1/2 -translate-x-1/2 shadow-2xl"
        >
          <IconArrowDown className="size-4" />
          Resume autoscroll
        </Button>
      ) : null}
    </div>
  );
};

// -- Exports ------------------------------------------------------------------

export { BraccatoRenderer };
