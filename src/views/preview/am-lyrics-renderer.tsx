import { alternateMatchesMainText } from "@/domain/language/alternate-visibility";
import { useRendererAudioSync } from "@/hooks/use-renderer-audio-sync";
import { wake } from "@/lib/frame-loop";
import { useAudioStore } from "@/stores/audio";
import type { AmLyrics as AmLyricsElement } from "@uimaxbai/am-lyrics";
import { useEffect, useRef, useState } from "react";

// -- Interfaces ---------------------------------------------------------------

interface AmLyricsRendererProps {
  ttmlString: string;
  durationSeconds: number;
}

// -- Element registration -----------------------------------------------------

let registerPromise: Promise<void> | null = null;
function ensureRegistered(): Promise<void> {
  if (!registerPromise) {
    registerPromise = import("@uimaxbai/am-lyrics/am-lyrics.js").then(() => undefined);
  }
  return registerPromise;
}

function markMatchingAlternateElements(el: AmLyricsElement): void {
  const lines = el.shadowRoot?.querySelectorAll<HTMLElement>(".lyrics-line");
  if (!lines) return;

  for (const line of lines) {
    for (const alternate of line.querySelectorAll<HTMLElement>("[data-composer-matching-alternate]")) {
      delete alternate.dataset.composerMatchingAlternate;
    }
    const mainText = [
      ...line.querySelectorAll<HTMLElement>(".main-vocal-container .lyrics-syllable:not(.transliteration)"),
    ]
      .map((syllable) => syllable.textContent ?? "")
      .join("");

    const translation = line.querySelector<HTMLElement>(".lyrics-translation-container");
    if (translation && alternateMatchesMainText(translation.textContent ?? "", mainText)) {
      translation.dataset.composerMatchingAlternate = "";
    }

    const lineRomanization = line.querySelector<HTMLElement>(".lyrics-romanization-container");
    if (lineRomanization && alternateMatchesMainText(lineRomanization.textContent ?? "", mainText)) {
      lineRomanization.dataset.composerMatchingAlternate = "";
    }

    const timedRomanization = [
      ...line.querySelectorAll<HTMLElement>(".main-vocal-container .lyrics-syllable.transliteration"),
    ];
    for (const syllable of timedRomanization) syllable.parentElement?.classList.add("has-transliteration");
    const romanizedText = timedRomanization.map((syllable) => syllable.textContent ?? "").join(" ");
    if (timedRomanization.length > 0 && alternateMatchesMainText(romanizedText, mainText)) {
      for (const syllable of timedRomanization) {
        syllable.parentElement?.classList.remove("has-transliteration");
        syllable.dataset.composerMatchingAlternate = "";
      }
    }
  }
}

function removeMatchingAlternatesAfterUpdate(el: AmLyricsElement): void {
  // The TTML property update starts parsing; assigning the parsed lyrics schedules
  // a second Lit render. Matching alternate nodes only exist after that render.
  void el.updateComplete.then(() => el.updateComplete).then(() => markMatchingAlternateElements(el));
}

// -- Component ----------------------------------------------------------------

const AmLyricsRenderer: React.FC<AmLyricsRendererProps> = ({ ttmlString, durationSeconds }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const elementRef = useRef<AmLyricsElement | null>(null);
  const latestTtmlRef = useRef(ttmlString);
  const latestDurationMsRef = useRef(durationSeconds * 1000);
  latestTtmlRef.current = ttmlString;
  latestDurationMsRef.current = durationSeconds * 1000;
  // react-doctor-disable-next-line react-doctor/rerender-state-only-in-handlers
  const [isRegistered, setIsRegistered] = useState(false);

  useEffect(() => {
    let cancelled = false;
    ensureRegistered().then(() => {
      if (!cancelled) setIsRegistered(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isRegistered) return;
    const container = containerRef.current;
    if (!container) return;

    const el = document.createElement("am-lyrics") as AmLyricsElement;
    const matchingAlternateObserver = new MutationObserver(() => markMatchingAlternateElements(el));
    // am-lyrics parses our iTunes sidecars, but keeps both alternate tracks
    // behind controls in its built-in header. Composer hides that header, so
    // enable the tracks directly before the TTML is parsed.
    Reflect.set(el, "showRomanization", true);
    Reflect.set(el, "showTranslation", true);
    el.ttml = latestTtmlRef.current;
    removeMatchingAlternatesAfterUpdate(el);
    el.songDurationMs = latestDurationMsRef.current;
    el.className = "block flex-1 mx-auto w-full max-w-3xl px-6";
    el.style.setProperty("--am-lyrics-highlight-color", "var(--color-composer-text)");

    const handleLineClick = (event: Event) => {
      const detail = (event as CustomEvent<{ timestamp: number }>).detail;
      if (detail?.timestamp == null) return;
      const audio = useAudioStore.getState();
      audio.seekTo(detail.timestamp / 1000);
      audio.setIsPlaying(true);
    };
    el.addEventListener("line-click", handleLineClick);

    container.appendChild(el);
    if (el.shadowRoot) matchingAlternateObserver.observe(el.shadowRoot, { childList: true, subtree: true });
    elementRef.current = el;
    // The element arrives once the registration import resolves, long after the
    // mount wake expired, so the first frame that can address it has to be asked for.
    wake();

    const injectHideStyle = () => {
      if (!el.shadowRoot) return;
      if (el.shadowRoot.querySelector("style[data-composer-hide]")) return;
      const style = document.createElement("style");
      style.dataset.composerHide = "";
      style.textContent = `
        .lyrics-header,
        [data-composer-matching-alternate] { display: none !important; }
      `;
      el.shadowRoot.appendChild(style);
    };
    injectHideStyle();
    el.updateComplete.then(injectHideStyle);

    return () => {
      matchingAlternateObserver.disconnect();
      el.removeEventListener("line-click", handleLineClick);
      el.remove();
      elementRef.current = null;
    };
  }, [isRegistered]);

  useEffect(() => {
    const el = elementRef.current;
    if (!el) return;
    // react-doctor-disable-next-line react-doctor/no-event-handler
    if (el.ttml !== ttmlString) {
      el.ttml = ttmlString;
      removeMatchingAlternatesAfterUpdate(el);
    }
  }, [ttmlString]);

  useEffect(() => {
    const el = elementRef.current;
    if (!el) return;
    el.songDurationMs = durationSeconds * 1000;
  }, [durationSeconds]);

  useRendererAudioSync(
    elementRef,
    (el, audio) => {
      el.currentTime = audio.currentTime * 1000;
    },
    "am-lyrics-renderer",
  );

  return <div ref={containerRef} className="flex flex-col flex-1 min-h-0" />;
};

// -- Exports ------------------------------------------------------------------

export { AmLyricsRenderer };
