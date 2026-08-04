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

// Registering the tag evaluates `class ... extends HTMLElement`, which throws
// during vite-react-ssg's server render. Deferring it to an effect keeps the tag
// out of the server bundle; the element upgrades in place once the chunk lands,
// and braccato reapplies every property written before that. A failure here
// leaves an un-upgraded tag that renders nothing, so it must not go unreported.
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

// 1.0.0 stopped listening for this itself, so without the relay autoscroll drags
// the reader back to the active line the moment they scroll away from it.
function handleBraccatoScroll(e: Event): void {
  (e.currentTarget as BraccatoLyricsElement).renderer?.noteUserScroll();
}

// -- Component ----------------------------------------------------------------

const BraccatoRenderer: React.FC<BraccatoRendererProps> = ({ ttmlString }) => {
  const elementRef = useRef<BraccatoLyricsElement>(null);
  // The song duration reaches the parser through the document's own `dur`
  // attribute; `TTMLParser.parse` ignores its second argument.
  const lyrics = useMemo(() => TTMLParser.parse(ttmlString), [ttmlString]);
  const latestLyricsRef = useRef(lyrics);
  // Whether the reader has scrolled away from the song. Owned by the renderer,
  // which tracks it already, rather than by a scroll listener of our own.
  const [isAutoscrollPaused, setIsAutoscrollPaused] = useState(false);

  // Seeds the element as well as wiring the listener, so a node swapped in
  // without a lyrics change still gets the song. The effect below only covers
  // the other direction.
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

  // Both writes belong to the commit, not the render. A render that React
  // replays or throws away must not leave the seed above holding a song the DOM
  // never received, which `<Activity>` prerendering makes reachable.
  useEffect(() => {
    latestLyricsRef.current = lyrics;
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
