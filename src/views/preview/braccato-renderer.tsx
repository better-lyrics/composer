import type { BraccatoLyricsElement, LineClickDetail } from "@braccato/core/element";
import { TTMLParser } from "@braccato/parsers";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useRendererAudioSync } from "@/hooks/use-renderer-audio-sync";
import { useAudioStore } from "@/stores/audio";

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

// -- Component ----------------------------------------------------------------

const BraccatoRenderer: React.FC<BraccatoRendererProps> = ({ ttmlString }) => {
  const elementRef = useRef<BraccatoLyricsElement>(null);
  // The song duration reaches the parser through the document's own `dur`
  // attribute; `TTMLParser.parse` ignores its second argument.
  const lyrics = useMemo(() => TTMLParser.parse(ttmlString), [ttmlString]);
  const latestLyricsRef = useRef(lyrics);

  // Seeds the element as well as wiring the listener, so a node swapped in
  // without a lyrics change still gets the song. The effect below only covers
  // the other direction.
  const setElement = useCallback((el: BraccatoLyricsElement | null) => {
    elementRef.current = el;
    if (!el) return;
    el.lyrics = latestLyricsRef.current;
    el.addEventListener("braccato:line-click", handleBraccatoLineClick);
    return () => {
      el.removeEventListener("braccato:line-click", handleBraccatoLineClick);
      elementRef.current = null;
    };
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

  return <braccato-lyrics ref={setElement} className="block flex-1 mx-auto w-full max-w-3xl px-6 overflow-y-auto" />;
};

// -- Exports ------------------------------------------------------------------

export { BraccatoRenderer };
