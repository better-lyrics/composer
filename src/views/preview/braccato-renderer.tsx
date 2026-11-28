import type { Bounds } from "@/domain/word/bounds";
import { useFrameLoop } from "@/hooks/use-frame-loop";
import { useOpenProjectId } from "@/hooks/useOpenProjectId";
import { wake } from "@/lib/frame-loop";
import { Button } from "@/ui/button";
import { IconButton } from "@/ui/icon-button";
import { centeredFadeVariants, centeredSlideUpVariants, springSnappy } from "@/utils/animationVariants";
import { cn } from "@/utils/cn";
import { braccatoLyrics } from "@/views/preview/braccato-lyrics";
import braccatoTheme from "@/views/preview/braccato-theme.css?raw";
import { type AppliedTick, tickBraccato } from "@/views/preview/braccato-tick";
import { type TimedLineElement, markLinesOutsideFocus, useFocusFade } from "@/views/preview/focus-fade";
import { LYRICS_ELEMENT_CLASS, type LyricsLayout } from "@/views/preview/lyrics-layout";
import { PreviewLoadFailed } from "@/views/preview/preview-load-failed";
import { AUDIO_STORE_PLAYBACK, type RendererPlayback } from "@/views/preview/renderer-playback";
import type { Lyric } from "@braccato/core";
import type {
  BraccatoLyricsElement,
  LineClickDetail,
  LyricsErrorDetail,
  ScrollStateDetail,
} from "@braccato/core/element";
import braccatoWasmUrl from "@braccato/core/wasm?url";
import { TTMLParser } from "@braccato/parsers";
import { IconArrowDown } from "@tabler/icons-react";
import { AnimatePresence, m, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// -- Interfaces ---------------------------------------------------------------

interface BraccatoRendererProps {
  ttmlString: string;
  layout?: LyricsLayout;
  focusRange?: Bounds | null;
  playback?: RendererPlayback;
}

type Registration = "pending" | "ready" | "failed";

// -- Constants -----------------------------------------------------------------

const LOG_PREFIX = "[BraccatoRenderer]";

// A project not yet saved has no id, but its edits are still one song to swap in place.
const UNSAVED_SONG_KEY = "unsaved";

// -- Element registration -----------------------------------------------------

// Must stay dynamic: registering evaluates `class ... extends HTMLElement`, which has no
// HTMLElement during the vite-react-ssg prerender and fails the build.
let registerPromise: Promise<boolean> | null = null;
function ensureRegistered(): Promise<boolean> {
  registerPromise ??= import("@braccato/core/element")
    .then(async ({ defineLyricsElement, load }) => {
      await load(braccatoWasmUrl);
      defineLyricsElement();
      return true;
    })
    .catch((error: unknown) => {
      registerPromise = null;
      console.error(LOG_PREFIX, "failed to register <braccato-lyrics>", error);
      return false;
    });
  return registerPromise;
}

// The renderer reads each line's colours when it lays the lines out, so a changed mark needs a relayout.
function markFocus(el: BraccatoLyricsElement, range: Bounds | null): void {
  const renderer = el.renderer;
  if (!renderer) return;
  const lines: TimedLineElement[] = renderer
    .lineElements()
    .map(({ element }: { element: Element }, index: number) => ({
      element,
      startSeconds: renderer.timing(index)?.[0] ?? 0,
    }));
  if (markLinesOutsideFocus(lines, range)) renderer.relayout(true);
}

function skipWritePhase(): void {}

// -- Component ----------------------------------------------------------------

const BraccatoRenderer: React.FC<BraccatoRendererProps> = ({
  ttmlString,
  layout = "page",
  focusRange = null,
  playback = AUDIO_STORE_PLAYBACK,
}) => {
  const elementRef = useRef<BraccatoLyricsElement>(null);
  const lyrics = useMemo(() => braccatoLyrics(TTMLParser.parse(ttmlString)), [ttmlString]);
  const songwriters = useMemo(() => TTMLParser.metadata(ttmlString).songwriters, [ttmlString]);
  const songKey = useOpenProjectId() ?? UNSAVED_SONG_KEY;
  const latestLyricsRef = useRef(lyrics);
  const latestSongwritersRef = useRef(songwriters);
  const latestSongKeyRef = useRef(songKey);
  const latestFocusRangeRef = useRef(focusRange);
  useFocusFade(focusRange, latestFocusRangeRef, (range) => {
    if (elementRef.current) markFocus(elementRef.current, range);
  });
  const initializedElementRef = useRef<BraccatoLyricsElement | null>(null);
  const appliedLyricsRef = useRef<Lyric[] | null>(null);
  const appliedSongKeyRef = useRef<string | null>(null);
  const appliedTickRef = useRef<AppliedTick | null>(null);
  const [isAutoscrollPaused, setIsAutoscrollPaused] = useState(false);
  const [registration, setRegistration] = useState<Registration>("pending");
  const reducedMotion = useReducedMotion();

  const resumeAutoscroll = useCallback(() => {
    elementRef.current?.resumeAutoscroll();
    playback.play();
  }, [playback]);

  const handleLineClick = useCallback(
    (e: CustomEvent<LineClickDetail>) => {
      playback.seekTo(e.detail.timeS);
      resumeAutoscroll();
    },
    [resumeAutoscroll, playback],
  );

  const handleScrollState = useCallback((e: CustomEvent<ScrollStateDetail>) => {
    setIsAutoscrollPaused(e.detail.userScrolling);
  }, []);

  const handleLyricsLoaded = useCallback((e: Event) => {
    markFocus(e.currentTarget as BraccatoLyricsElement, latestFocusRangeRef.current);
  }, []);

  // A browser without WebGL2 cannot build the renderer, which leaves the element empty.
  const handleError = useCallback((e: CustomEvent<LyricsErrorDetail>) => {
    const { phase, error } = e.detail;
    console.error(LOG_PREFIX, `<braccato-lyrics> failed (${phase})`, error);
    if (phase === "connect") setRegistration("failed");
  }, []);

  const applyLyrics = useCallback(
    (el: BraccatoLyricsElement, next: Lyric[], songwriters: readonly string[], songKey: string) => {
      if (appliedLyricsRef.current === next && appliedSongKeyRef.current === songKey) return;
      appliedLyricsRef.current = next;
      appliedSongKeyRef.current = songKey;
      // The same songKey swaps edits into the lines on screen; another project's key builds anew.
      el.lyricsOptions = { songwriters, songKey };
      el.lyrics = next;
      markFocus(el, latestFocusRangeRef.current);
    },
    [],
  );

  // Activity re-attaches this ref on every reveal; re-initializing the same element rebuilds its lines.
  // The listeners go on here rather than in an effect: the element reports a failed connect from a
  // microtask, which can run before a passive effect would attach them.
  const setElement = useCallback(
    (el: BraccatoLyricsElement | null) => {
      elementRef.current = el;
      if (!el) return;
      el.addEventListener("braccato:line-click", handleLineClick);
      el.addEventListener("braccato:scroll-state", handleScrollState);
      el.addEventListener("braccato:lyrics-loaded", handleLyricsLoaded);
      el.addEventListener("braccato:error", handleError);
      if (initializedElementRef.current !== el) {
        initializedElementRef.current = el;
        appliedLyricsRef.current = null;
        appliedSongKeyRef.current = null;
        appliedTickRef.current = null;
        applyLyrics(el, latestLyricsRef.current, latestSongwritersRef.current, latestSongKeyRef.current);
        // A paused preview runs no frames, and the element needs one to get the clock.
        wake();
      }
      return () => {
        elementRef.current = null;
        el.removeEventListener("braccato:line-click", handleLineClick);
        el.removeEventListener("braccato:scroll-state", handleScrollState);
        el.removeEventListener("braccato:lyrics-loaded", handleLyricsLoaded);
        el.removeEventListener("braccato:error", handleError);
      };
    },
    [applyLyrics, handleLineClick, handleScrollState, handleLyricsLoaded, handleError],
  );

  useEffect(() => {
    // The element renders only once its wasm has loaded, so a failed load shows the fallback
    // rather than an empty element.
    void ensureRegistered().then((registered) => setRegistration(registered ? "ready" : "failed"));
  }, []);

  useEffect(() => {
    latestLyricsRef.current = lyrics;
    latestSongwritersRef.current = songwriters;
    latestSongKeyRef.current = songKey;
    const element = elementRef.current;
    if (element) applyLyrics(element, lyrics, songwriters, songKey);
  }, [lyrics, songwriters, songKey, applyLyrics]);

  // Binding `source` would make braccato own the clock, and the frame preview has no media
  // element to bind; every host hands it the playback samples instead.
  useFrameLoop(
    {
      read: () => {
        const el = elementRef.current;
        const audio = playback.sample();
        if (!el || !audio) return;
        appliedTickRef.current = tickBraccato(el, audio, appliedTickRef.current);
      },
      write: skipWritePhase,
    },
    "braccato-renderer",
  );

  return (
    <div data-lyrics-layout={layout} className="relative flex flex-col flex-1 min-h-0">
      {registration === "failed" ? (
        <PreviewLoadFailed />
      ) : registration === "ready" ? (
        <braccato-lyrics ref={setElement} theme={braccatoTheme} className={LYRICS_ELEMENT_CLASS[layout]} />
      ) : null}
      <AnimatePresence>
        {isAutoscrollPaused ? (
          <m.div
            key="resume-autoscroll"
            variants={reducedMotion ? centeredFadeVariants : centeredSlideUpVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            transition={springSnappy}
            className={cn("absolute left-1/2 z-10", layout === "sidebar" ? "bottom-3" : "bottom-6")}
          >
            {layout === "sidebar" ? (
              <IconButton
                variant="secondary"
                label="Resume autoscroll"
                icon={<IconArrowDown className="size-4" />}
                onClick={resumeAutoscroll}
                className="shadow-2xl backdrop-blur-md"
              />
            ) : (
              <Button variant="secondary" hasIcon onClick={resumeAutoscroll} className="shadow-2xl backdrop-blur-md">
                <IconArrowDown className="size-4" />
                Resume autoscroll
              </Button>
            )}
          </m.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
};

// -- Exports ------------------------------------------------------------------

export { BraccatoRenderer };
