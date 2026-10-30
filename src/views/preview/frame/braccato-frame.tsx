import type { Bounds } from "@/domain/word/bounds";
import { useFrameLoop } from "@/hooks/use-frame-loop";
import { useAudioStore } from "@/stores/audio";
import { cn } from "@/utils/cn";
import {
  type FrameClock,
  type FromFrameMessage,
  type ToFrameMessage,
  messageKind,
  previewFrameUrl,
} from "@/views/preview/frame/preview-frame-protocol";
import { type RefObject, useEffect, useEffectEvent, useRef, useState } from "react";

// -- Interfaces ----------------------------------------------------------------

interface BraccatoFrameProps {
  ttmlString: string;
  focusRange: Bounds | null;
  frameOrigin: string;
  onUnavailable: () => void;
}

// -- Constants -----------------------------------------------------------------

const LOG_PREFIX = "[BraccatoFrame]";

// A page that loads but never answers (offline, blocked, an error page) falls back to the inline preview.
const READY_AFTER_LOAD_MS = 2_000;
const READY_DEADLINE_MS = 15_000;

// -- Functions -----------------------------------------------------------------

function postToFrame(frame: HTMLIFrameElement | null, frameOrigin: string, message: ToFrameMessage): void {
  frame?.contentWindow?.postMessage(message, frameOrigin);
}

function themeMessage(): ToFrameMessage {
  const root = document.documentElement;
  return { kind: "theme", style: root.getAttribute("style") ?? "", scheme: root.dataset.scheme };
}

function sameClock(a: FrameClock | null, b: FrameClock): boolean {
  return a !== null && a.time === b.time && a.playing === b.playing && a.rate === b.rate;
}

function replayKey({ key }: Extract<FromFrameMessage, { kind: "key" }>): void {
  const { type, ...init } = key;
  document.dispatchEvent(new KeyboardEvent(type, { ...init, bubbles: true, cancelable: true }));
}

// -- Hooks ---------------------------------------------------------------------

function useFrameClock(frameRef: RefObject<HTMLIFrameElement | null>, frameOrigin: string, enabled: boolean): void {
  const sentRef = useRef<FrameClock | null>(null);
  useFrameLoop(
    () => {
      const audio = useAudioStore.getState().audioElement;
      if (!audio) return;
      const clock = {
        time: audio.currentTime,
        playing: !audio.paused,
        rate: audio.playbackRate,
        sentAt: performance.timeOrigin + performance.now(),
      };
      if (sameClock(sentRef.current, clock)) return;
      sentRef.current = clock;
      postToFrame(frameRef.current, frameOrigin, { kind: "clock", clock });
    },
    "braccato-frame clock",
    enabled,
  );
  useEffect(() => {
    if (!enabled) sentRef.current = null;
  }, [enabled]);
}

function useThemeMirror(frameRef: RefObject<HTMLIFrameElement | null>, frameOrigin: string, enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;
    const send = () => postToFrame(frameRef.current, frameOrigin, themeMessage());
    send();
    const observer = new MutationObserver(send);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["style", "data-scheme"] });
    return () => observer.disconnect();
  }, [frameRef, frameOrigin, enabled]);
}

// -- Component -----------------------------------------------------------------

const BraccatoFrame: React.FC<BraccatoFrameProps> = ({ ttmlString, focusRange, frameOrigin, onUnavailable }) => {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [src] = useState(() => previewFrameUrl(frameOrigin, window.location.origin));
  const [isReady, setIsReady] = useState(false);
  const [isShown, setIsShown] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const reportUnavailable = useEffectEvent(onUnavailable);

  useFrameClock(frameRef, frameOrigin, isReady);
  useThemeMirror(frameRef, frameOrigin, isReady);

  useEffect(() => {
    if (isReady) postToFrame(frameRef.current, frameOrigin, { kind: "lyrics", ttml: ttmlString });
  }, [isReady, frameOrigin, ttmlString]);

  const begin = focusRange?.begin;
  const end = focusRange?.end;
  useEffect(() => {
    if (!isReady) return;
    const range = begin === undefined || end === undefined ? null : { begin, end };
    postToFrame(frameRef.current, frameOrigin, { kind: "focus", range });
  }, [isReady, frameOrigin, begin, end]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== frameOrigin || event.source !== frameRef.current?.contentWindow) return;
      if (messageKind(event.data) === null) return;
      const message = event.data as FromFrameMessage;
      if (message.kind === "ready") setIsReady(true);
      else if (message.kind === "shown") setIsShown(true);
      else if (message.kind === "play") useAudioStore.getState().setIsPlaying(true);
      else if (message.kind === "seek" && Number.isFinite(message.seconds))
        useAudioStore.getState().seekTo(message.seconds);
      else if (message.kind === "key") replayKey(message);
    };
    window.addEventListener("message", handleMessage);
    // Activity runs no effects while the sidebar is hidden, so a frame that loaded then has its ready unheard.
    if (isLoaded) postToFrame(frameRef.current, frameOrigin, { kind: "connect" });
    return () => window.removeEventListener("message", handleMessage);
  }, [frameOrigin, isLoaded]);

  useEffect(() => {
    if (isReady) return;
    const timeout = window.setTimeout(
      () => {
        console.warn(LOG_PREFIX, "preview frame did not answer, showing the inline preview", src);
        reportUnavailable();
      },
      isLoaded ? READY_AFTER_LOAD_MS : READY_DEADLINE_MS,
    );
    return () => window.clearTimeout(timeout);
  }, [isReady, isLoaded, src]);

  return (
    <iframe
      ref={frameRef}
      src={src}
      title="Lyrics preview"
      onLoad={() => setIsLoaded(true)}
      className={cn("block flex-1 min-h-0 w-full border-0 bg-transparent", !isShown && "opacity-0")}
    />
  );
};

// -- Exports -------------------------------------------------------------------

export { BraccatoFrame };
