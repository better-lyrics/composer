import type { Bounds } from "@/domain/word/bounds";
import { cancelNextFrame, nextFrame } from "@/lib/frame-loop";
import { BraccatoRenderer } from "@/views/preview/braccato-renderer";
import { createFramePlayback } from "@/views/preview/frame/frame-playback";
import {
  type FrameKey,
  type FromFrameMessage,
  type ToFrameMessage,
  messageKind,
} from "@/views/preview/frame/preview-frame-protocol";
import { useEffect, useRef, useState } from "react";

// -- Interfaces ----------------------------------------------------------------

interface PreviewFrameAppProps {
  parentOrigin: string;
}

// -- Constants -----------------------------------------------------------------

// Browser commands a page can block but the frame must leave alone: reload, find, address bar,
// zoom, and copy or select-all of the lyrics text.
const BROWSER_COMMAND_KEYS = new Set(["r", "f", "l", "+", "-", "=", "0", "a", "c"]);
const BROWSER_KEYS = new Set(["Tab", "F5", "F11", "F12"]);

// -- Functions -----------------------------------------------------------------

function isBrowserKey(event: KeyboardEvent): boolean {
  if (BROWSER_KEYS.has(event.key)) return true;
  return (event.metaKey || event.ctrlKey) && BROWSER_COMMAND_KEYS.has(event.key.toLowerCase());
}

function isOnButton(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest("button") !== null;
}

function hasTextSelection(): boolean {
  return (document.getSelection()?.toString() ?? "") !== "";
}

function frameKey(event: KeyboardEvent): FrameKey {
  return {
    type: event.type === "keyup" ? "keyup" : "keydown",
    key: event.key,
    code: event.code,
    location: event.location,
    repeat: event.repeat,
    altKey: event.altKey,
    ctrlKey: event.ctrlKey,
    metaKey: event.metaKey,
    shiftKey: event.shiftKey,
  };
}

function applyTheme(style: string, scheme: string | undefined): void {
  const root = document.documentElement;
  root.setAttribute("style", style);
  if (scheme) root.dataset.scheme = scheme;
  else delete root.dataset.scheme;
}

// -- Component -----------------------------------------------------------------

const PreviewFrameApp: React.FC<PreviewFrameAppProps> = ({ parentOrigin }) => {
  const [post] = useState(() => (message: FromFrameMessage) => window.parent.postMessage(message, parentOrigin));
  const [playback] = useState(() => createFramePlayback(post));
  const [ttml, setTtml] = useState<string | null>(null);
  const [focusRange, setFocusRange] = useState<Bounds | null>(null);
  const [hasTheme, setHasTheme] = useState(false);
  const shownRef = useRef(false);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== parentOrigin || event.source !== window.parent || messageKind(event.data) === null) return;
      const message = event.data as ToFrameMessage;
      if (message.kind === "connect") {
        post({ kind: "ready" });
        // The parent may have missed the first one while its sidebar was hidden.
        if (shownRef.current) post({ kind: "shown" });
      } else if (message.kind === "clock") playback.receive(message.clock);
      else if (message.kind === "stop") playback.stop();
      else if (message.kind === "lyrics") setTtml(message.ttml);
      else if (message.kind === "focus") setFocusRange(message.range);
      else if (message.kind === "theme") {
        applyTheme(message.style, message.scheme);
        setHasTheme(true);
      }
    };
    // The Timeline's shortcuts live in the parent document, so keys pressed here go there.
    const forwardKey = (event: KeyboardEvent) => {
      if (isBrowserKey(event) || isOnButton(event.target)) return;
      event.preventDefault();
      post({ kind: "key", key: frameKey(event) });
    };
    // A click in the inline preview left focus, paste and outside-press dismissal with the app.
    const notifyPointerDown = () => post({ kind: "pointerdown" });
    const notifyClick = () => post({ kind: "click" });
    const releaseFocus = (event: PointerEvent) => {
      if (!isOnButton(event.target) && !hasTextSelection()) post({ kind: "release-focus" });
    };
    window.addEventListener("message", handleMessage);
    window.addEventListener("keydown", forwardKey);
    window.addEventListener("keyup", forwardKey);
    window.addEventListener("pointerdown", notifyPointerDown);
    window.addEventListener("pointerup", releaseFocus);
    window.addEventListener("click", notifyClick);
    post({ kind: "ready" });
    return () => {
      window.removeEventListener("message", handleMessage);
      window.removeEventListener("keydown", forwardKey);
      window.removeEventListener("keyup", forwardKey);
      window.removeEventListener("pointerdown", notifyPointerDown);
      window.removeEventListener("pointerup", releaseFocus);
      window.removeEventListener("click", notifyClick);
    };
  }, [parentOrigin, playback, post]);

  const isPainted = hasTheme && ttml !== null;
  useEffect(() => {
    if (!isPainted) return;
    // Two frames: the first paints the lyrics, the second is on screen.
    let handle = nextFrame(() => {
      handle = nextFrame(() => {
        shownRef.current = true;
        post({ kind: "shown" });
      });
    });
    return () => cancelNextFrame(handle);
  }, [isPainted, post]);

  return (
    <div className="flex flex-col h-dvh overflow-hidden bg-composer-bg-dark">
      {ttml !== null && (
        <BraccatoRenderer ttmlString={ttml} layout="sidebar" focusRange={focusRange} playback={playback} />
      )}
    </div>
  );
};

// -- Exports -------------------------------------------------------------------

export { PreviewFrameApp };
