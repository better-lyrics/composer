import type { BraccatoLyricsElement, LineClickDetail } from "@braccato/core/element";
import { TTMLParser } from "@braccato/parsers";
import { IconArrowDown } from "@tabler/icons-react";
import { AnimatePresence, m, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRendererAudioSync } from "@/hooks/use-renderer-audio-sync";
import { wake } from "@/lib/frame-loop";
import { useAudioStore } from "@/stores/audio";
import { Button } from "@/ui/button";
import { centeredFadeVariants, centeredSlideUpVariants, springSnappy } from "@/utils/animationVariants";
import braccatoTheme from "@/views/preview/braccato-theme.css?raw";

// -- Interfaces ---------------------------------------------------------------

interface BraccatoRendererProps {
  ttmlString: string;
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

// -- Component ----------------------------------------------------------------

const BraccatoRenderer: React.FC<BraccatoRendererProps> = ({ ttmlString }) => {
  const elementRef = useRef<BraccatoLyricsElement>(null);
  const lyrics = useMemo(() => TTMLParser.parse(ttmlString), [ttmlString]);
  const latestLyricsRef = useRef(lyrics);
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
      (e.currentTarget as BraccatoLyricsElement).renderer?.noteUserScroll();
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

  const setElement = useCallback(
    (el: BraccatoLyricsElement | null) => {
      elementRef.current = el;
      if (!el) return;
      el.theme = braccatoTheme;
      el.host = { setResumeAffordanceVisible: setIsAutoscrollPaused };
      el.lyrics = latestLyricsRef.current;
      el.addEventListener("braccato:line-click", handleLineClick);
      el.addEventListener("scroll", handleScroll, { passive: true });
      return () => {
        el.removeEventListener("braccato:line-click", handleLineClick);
        el.removeEventListener("scroll", handleScroll);
        clearResumeWake();
        elementRef.current = null;
      };
    },
    [handleScroll, handleLineClick, clearResumeWake],
  );

  useEffect(() => {
    // The element upgrades once the registration import resolves, long after the mount
    // wake expired, so the first frame that can address its accessors has to be asked for.
    void ensureRegistered().then(wake);
  }, []);

  useEffect(() => {
    latestLyricsRef.current = lyrics;
    const element = elementRef.current;
    if (element) element.lyrics = lyrics;
  }, [lyrics]);

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
    <div className="relative flex flex-col flex-1 min-h-0">
      <braccato-lyrics ref={setElement} className="block flex-1 mx-auto w-full max-w-3xl px-6" />
      <AnimatePresence>
        {isAutoscrollPaused ? (
          <m.div
            key="resume-autoscroll"
            variants={reducedMotion ? centeredFadeVariants : centeredSlideUpVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            transition={springSnappy}
            className="absolute bottom-6 left-1/2 z-10"
          >
            <Button variant="secondary" hasIcon onClick={resumeAutoscroll} className="shadow-2xl backdrop-blur-md">
              <IconArrowDown className="size-4" />
              Resume autoscroll
            </Button>
          </m.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
};

// -- Exports ------------------------------------------------------------------

export { BraccatoRenderer, RESUME_AFFORDANCE_WAKE_MS };
