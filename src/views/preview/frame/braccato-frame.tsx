import type { Bounds } from "@/domain/word/bounds";
import { useFrameLoop } from "@/hooks/use-frame-loop";
import { useAudioStore } from "@/stores/audio";
import { AUDIO_STORE_PLAYBACK } from "@/views/preview/renderer-playback";
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
const PARENT_POINTER_ATTRIBUTE = "data-parent-pointer";

// A page that loads but never answers (offline, blocked, an error page) falls back to the inline preview.
const READY_AFTER_LOAD_MS = 2_000;
const SHOWN_AFTER_READY_MS = 10_000;
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

// Outside-press dismissal (popovers, menus) listens for presses and clicks in this document.
function replayPointerDown(frame: HTMLIFrameElement): void {
  frame.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true, isPrimary: true }));
  frame.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
}

function replayClick(frame: HTMLIFrameElement): void {
  frame.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true }));
  frame.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
}

// -- Hooks ---------------------------------------------------------------------

// `connection` changes on every ready, so a reloaded frame gets the clock again.
function useFrameClock(frameRef: RefObject<HTMLIFrameElement | null>, frameOrigin: string, connection: number): void {
  const enabled = connection > 0;
  const sentRef = useRef<FrameClock | null>(null);
  const stoppedRef = useRef(false);
  useFrameLoop(
    () => {
      const audio = AUDIO_STORE_PLAYBACK.sample();
      if (!audio) {
        // A song with no audio element stops the frame where it is instead of letting it run on.
        if (stoppedRef.current) return;
        stoppedRef.current = true;
        sentRef.current = null;
        postToFrame(frameRef.current, frameOrigin, { kind: "stop" });
        return;
      }
      stoppedRef.current = false;
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
    sentRef.current = null;
    stoppedRef.current = false;
  }, [connection]);
}

function useThemeMirror(frameRef: RefObject<HTMLIFrameElement | null>, frameOrigin: string, connection: number): void {
  useEffect(() => {
    if (connection === 0) return;
    const send = () => postToFrame(frameRef.current, frameOrigin, themeMessage());
    send();
    const observer = new MutationObserver(send);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["style", "data-scheme"] });
    return () => observer.disconnect();
  }, [frameRef, frameOrigin, connection]);
}

// Pointer events over a cross-process frame go to the frame, so a drag that crosses it
// (sidebar resize, marquee, word drags) would lose its moves and its release.
function useParentPointerPassThrough(frameRef: RefObject<HTMLIFrameElement | null>): void {
  useEffect(() => {
    const press = (event: PointerEvent) => {
      if (event.isTrusted) frameRef.current?.toggleAttribute(PARENT_POINTER_ATTRIBUTE, true);
    };
    const release = () => frameRef.current?.removeAttribute(PARENT_POINTER_ATTRIBUTE);
    document.addEventListener("pointerdown", press, true);
    window.addEventListener("pointerup", release, true);
    window.addEventListener("pointercancel", release, true);
    return () => {
      document.removeEventListener("pointerdown", press, true);
      window.removeEventListener("pointerup", release, true);
      window.removeEventListener("pointercancel", release, true);
      release();
    };
  }, [frameRef]);
}

// -- Component -----------------------------------------------------------------

const BraccatoFrame: React.FC<BraccatoFrameProps> = ({ ttmlString, focusRange, frameOrigin, onUnavailable }) => {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [src] = useState(() => previewFrameUrl(frameOrigin, window.location.origin));
  const [connection, setConnection] = useState(0);
  const isReady = connection > 0;
  const [isShown, setIsShown] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const reportUnavailable = useEffectEvent(onUnavailable);

  useFrameClock(frameRef, frameOrigin, connection);
  useThemeMirror(frameRef, frameOrigin, connection);
  useParentPointerPassThrough(frameRef);

  useEffect(() => {
    if (connection > 0) postToFrame(frameRef.current, frameOrigin, { kind: "lyrics", ttml: ttmlString });
  }, [connection, frameOrigin, ttmlString]);

  const begin = focusRange?.begin;
  const end = focusRange?.end;
  useEffect(() => {
    if (connection === 0) return;
    const range = begin === undefined || end === undefined ? null : { begin, end };
    postToFrame(frameRef.current, frameOrigin, { kind: "focus", range });
  }, [connection, frameOrigin, begin, end]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== frameOrigin || event.source !== frameRef.current?.contentWindow) return;
      if (messageKind(event.data) === null) return;
      const message = event.data as FromFrameMessage;
      const frame = frameRef.current;
      if (message.kind === "ready") setConnection((count) => count + 1);
      else if (message.kind === "shown") setIsShown(true);
      else if (message.kind === "play") useAudioStore.getState().setIsPlaying(true);
      else if (message.kind === "seek" && Number.isFinite(message.seconds))
        useAudioStore.getState().seekTo(message.seconds);
      else if (message.kind === "key") replayKey(message);
      else if (message.kind === "pointerdown" && frame) replayPointerDown(frame);
      else if (message.kind === "click" && frame) replayClick(frame);
      else if (message.kind === "release-focus" && document.activeElement === frame) frame?.blur();
    };
    window.addEventListener("message", handleMessage);
    // Activity runs no effects while the sidebar is hidden, so a frame that loaded then has its ready unheard.
    if (isLoaded) postToFrame(frameRef.current, frameOrigin, { kind: "connect" });
    return () => window.removeEventListener("message", handleMessage);
  }, [frameOrigin, isLoaded]);

  useEffect(() => {
    if (isShown) return;
    const deadline = !isLoaded ? READY_DEADLINE_MS : isReady ? SHOWN_AFTER_READY_MS : READY_AFTER_LOAD_MS;
    const timeout = window.setTimeout(
      () => {
        console.warn(LOG_PREFIX, "preview frame did not show the lyrics, showing the inline preview", src);
        reportUnavailable();
      },
      deadline,
    );
    return () => window.clearTimeout(timeout);
  }, [isShown, isReady, isLoaded, src]);

  return (
    <iframe
      ref={frameRef}
      src={src}
      title="Lyrics preview"
      // react-doctor-disable-next-line react-doctor/iframe-missing-sandbox -- the frame is cross-site, so allow-same-origin cannot lift the sandbox into this document; its module scripts and fonts need their own origin
      sandbox="allow-scripts allow-same-origin"
      onLoad={() => setIsLoaded(true)}
      className={cn(
        "block flex-1 min-h-0 w-full border-0 bg-transparent data-parent-pointer:pointer-events-none",
        !isShown && "opacity-0 pointer-events-none",
      )}
    />
  );
};

// -- Exports -------------------------------------------------------------------

export { BraccatoFrame };
