import { alternateMatchesMainText } from "@/domain/language/alternate-visibility";
import { useRendererAudioSync } from "@/hooks/use-renderer-audio-sync";
import { wake } from "@/lib/frame-loop";
import { useAudioStore } from "@/stores/audio";
import { Button } from "@/ui/button";
import { IconButton } from "@/ui/icon-button";
import { centeredFadeVariants, centeredSlideUpVariants, springSnappy } from "@/utils/animationVariants";
import { cn } from "@/utils/cn";
import braccatoTheme from "@/views/preview/braccato-theme.css?raw";
import { LYRICS_ELEMENT_CLASS, type LyricsLayout } from "@/views/preview/lyrics-layout";
import { type Lyric, injectRomanization, injectTranslation } from "@braccato/core";
import type { BraccatoLyricsElement, LineClickDetail } from "@braccato/core/element";
import { TTMLParser } from "@braccato/parsers";
import { IconArrowDown } from "@tabler/icons-react";
import { AnimatePresence, m, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// -- Interfaces ---------------------------------------------------------------

interface BraccatoRendererProps {
  ttmlString: string;
  layout?: LyricsLayout;
}

// -- Constants -----------------------------------------------------------------

const LOG_PREFIX = "[BraccatoRenderer]";

// Mirrors braccato's unexported USER_SCROLL_RESUME_DELAY_MS (25000); the margin lands the wake
// on the far side of its deadline instead of racing it.
const RESUME_AFFORDANCE_WAKE_MS = 25_500;

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

function decorateAlternateTracks(el: BraccatoLyricsElement, lyrics: Lyric[]): void {
  const renderer = el.renderer;
  if (!renderer) return;

  let decorated = false;
  for (let index = 0; index < lyrics.length; index++) {
    const lyric = lyrics[index];
    const line = renderer.lines[index];
    if (!line || lyric.isInstrumental) continue;

    if (lyric.romanization && !alternateMatchesMainText(lyric.romanization, lyric.words)) {
      injectRomanization(el.ownerDocument, line.lyricElement, line, lyric.romanization, lyric.timedRomanization);
      decorated = true;
    }

    const translation = lyric.translation?.text ?? Object.values(lyric.translations ?? {})[0];
    if (translation && !alternateMatchesMainText(translation, lyric.words)) {
      injectTranslation(el.ownerDocument, line.lyricElement, translation);
      decorated = true;
    }
  }

  if (decorated) renderer.relayout();
}

// -- Component ----------------------------------------------------------------

const BraccatoRenderer: React.FC<BraccatoRendererProps> = ({ ttmlString, layout = "page" }) => {
  const elementRef = useRef<BraccatoLyricsElement>(null);
  const lyrics = useMemo(() => TTMLParser.parse(ttmlString), [ttmlString]);
  const songwriters = useMemo(() => TTMLParser.metadata(ttmlString).songwriters, [ttmlString]);
  const latestLyricsRef = useRef(lyrics);
  const latestSongwritersRef = useRef(songwriters);
  const initializedElementRef = useRef<BraccatoLyricsElement | null>(null);
  const appliedLyricsRef = useRef<Lyric[] | null>(null);
  const rebuildScrollTopRef = useRef<number | null>(null);
  const appliedPlaybackRateRef = useRef(1);
  const [isAutoscrollPaused, setIsAutoscrollPaused] = useState(false);
  const resumeWakeRef = useRef<number | null>(null);
  const reducedMotion = useReducedMotion();

  const clearResumeWake = useCallback(() => {
    if (resumeWakeRef.current === null) return;
    window.clearTimeout(resumeWakeRef.current);
    resumeWakeRef.current = null;
  }, []);

  const handleScroll = useCallback(
    (e: Event) => {
      const el = e.currentTarget as BraccatoLyricsElement;
      const fromRebuild = rebuildScrollTopRef.current === el.scrollTop;
      rebuildScrollTopRef.current = null;
      if (fromRebuild) return;
      el.renderer?.noteUserScroll();
      clearResumeWake();
      resumeWakeRef.current = window.setTimeout(() => {
        resumeWakeRef.current = null;
        wake();
      }, RESUME_AFFORDANCE_WAKE_MS);
    },
    [clearResumeWake],
  );

  const resumeAutoscroll = useCallback(() => {
    clearResumeWake();
    elementRef.current?.renderer?.resumeAutoscroll();
    useAudioStore.getState().setIsPlaying(true);
    // Braccato clears the affordance and scrolls back on its next tick, which this
    // component drives, so a paused reader would otherwise see nothing happen.
    wake();
  }, [clearResumeWake]);

  const handleLineClick = useCallback(
    (e: Event) => {
      const detail = (e as CustomEvent<LineClickDetail>).detail;
      if (detail?.timeS == null) return;
      useAudioStore.getState().seekTo(detail.timeS);
      resumeAutoscroll();
    },
    [resumeAutoscroll],
  );

  const handleLyricsLoaded = useCallback((event: Event) => {
    const el = event.currentTarget as BraccatoLyricsElement;
    decorateAlternateTracks(el, latestLyricsRef.current);
  }, []);

  const applyLyrics = useCallback((el: BraccatoLyricsElement, next: Lyric[], songwriters: readonly string[]) => {
    if (appliedLyricsRef.current === next) return;
    const scrollTopBefore = el.scrollTop;
    // Braccato's in-place lyrics swap keeps the old scroll geometry; a fresh renderer (writing host) positions from scratch.
    if (appliedLyricsRef.current !== null) {
      // Cleared first so the fresh renderer's own build of the old lyrics is an empty one.
      el.lyrics = [];
      el.host = { setResumeAffordanceVisible: setIsAutoscrollPaused };
    }
    appliedLyricsRef.current = next;
    el.lyricsOptions = { songwriters };
    el.lyrics = next;
    // A rebuild that moves the scroll position fires one scroll the reader never made.
    rebuildScrollTopRef.current = el.scrollTop === scrollTopBefore ? null : el.scrollTop;
    decorateAlternateTracks(el, next);
  }, []);

  // Activity re-attaches this ref on every reveal; re-initializing the same element rebuilds its lines.
  const setElement = useCallback(
    (el: BraccatoLyricsElement | null) => {
      elementRef.current = el;
      if (!el || initializedElementRef.current === el) return;
      initializedElementRef.current = el;
      el.host = { setResumeAffordanceVisible: setIsAutoscrollPaused };
      applyLyrics(el, latestLyricsRef.current, latestSongwritersRef.current);
    },
    [applyLyrics],
  );

  useEffect(() => {
    const el = elementRef.current;
    if (!el) return;
    el.addEventListener("braccato:line-click", handleLineClick);
    el.addEventListener("braccato:lyrics-loaded", handleLyricsLoaded);
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      el.removeEventListener("braccato:line-click", handleLineClick);
      el.removeEventListener("braccato:lyrics-loaded", handleLyricsLoaded);
      el.removeEventListener("scroll", handleScroll);
      clearResumeWake();
    };
  }, [handleLineClick, handleLyricsLoaded, handleScroll, clearResumeWake]);

  useEffect(() => {
    // The element upgrades once the registration import resolves, long after the mount
    // wake expired, so the first frame that can address its accessors has to be asked for.
    void ensureRegistered().then(wake);
  }, []);

  useEffect(() => {
    latestLyricsRef.current = lyrics;
    latestSongwritersRef.current = songwriters;
    const element = elementRef.current;
    if (element) applyLyrics(element, lyrics, songwriters);
  }, [lyrics, songwriters, applyLyrics]);

  // Binding `source` would make braccato own the clock, and it only polls during
  // playback, freezing the preview whenever the timeline is scrubbed paused.
  useRendererAudioSync(
    elementRef,
    (el, audio) => {
      // Without the rate the word sweeps run on the wall clock and stutter at any
      // speed but 1x. Tracked here rather than read back off the element, which has
      // no properties to read until the registration import lands.
      if (appliedPlaybackRateRef.current !== audio.playbackRate) {
        appliedPlaybackRateRef.current = audio.playbackRate;
        el.tickOptions = { playbackRate: audio.playbackRate };
      }
      el.currentTime = audio.currentTime;
      el.playing = !audio.paused;
    },
    "braccato-renderer",
  );

  return (
    <div data-lyrics-layout={layout} className="relative flex flex-col flex-1 min-h-0">
      <braccato-lyrics ref={setElement} theme={braccatoTheme} className={LYRICS_ELEMENT_CLASS[layout]} />
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

export { BraccatoRenderer, RESUME_AFFORDANCE_WAKE_MS };
