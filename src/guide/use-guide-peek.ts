import { PEEK_VISIBLE_MS } from "@/domain/guide/peek-gate";
import { foldPeek, peekQueueSnapshot, subscribePeekQueue, tryShowPeek } from "@/guide/peek-queue";
import { useAudioStore } from "@/stores/audio";
import { useEscapeLayerStackStore, isAnyModalOpen } from "@/stores/escape-layer-stack";
import { isTypingTarget } from "@/utils/typing-target";
import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";

// -- State --------------------------------------------------------------------

let pointerDown = false;

// -- Helpers ------------------------------------------------------------------

function isBusy(cardOpen: boolean): boolean {
  return (
    cardOpen ||
    pointerDown ||
    useAudioStore.getState().isPlaying ||
    isAnyModalOpen() ||
    isTypingTarget(document.activeElement)
  );
}

// -- Hooks --------------------------------------------------------------------

// Shows the head of the peek queue when the user is idle, and folds it into the count after a few seconds.
function useGuidePeek(cardOpen: boolean) {
  const queue = useSyncExternalStore(subscribePeekQueue, peekQueueSnapshot, peekQueueSnapshot);
  const retryTimer = useRef<number | undefined>(undefined);
  const visibleTimer = useRef<{ id?: number; endsAt: number; remaining: number }>({ endsAt: 0, remaining: 0 });

  const attempt = useCallback(() => {
    window.clearTimeout(retryTimer.current);
    const wait = tryShowPeek(isBusy(cardOpen), performance.now());
    if (wait !== null) retryTimer.current = window.setTimeout(attempt, wait);
  }, [cardOpen]);

  useEffect(() => {
    if (cardOpen) foldPeek();
  }, [cardOpen]);

  useEffect(() => {
    if (queue.waiting.length === 0 || queue.showing) return;
    attempt();
  }, [queue, attempt]);

  useEffect(() => {
    const press = () => {
      pointerDown = true;
    };
    const release = () => {
      pointerDown = false;
      attempt();
    };
    window.addEventListener("pointerdown", press, true);
    window.addEventListener("pointerup", release, true);
    window.addEventListener("pointercancel", release, true);
    window.addEventListener("focusout", attempt);
    const stopAudio = useAudioStore.subscribe((state, previous) => {
      if (previous.isPlaying && !state.isPlaying) attempt();
    });
    const stopLayers = useEscapeLayerStackStore.subscribe(attempt);
    return () => {
      window.removeEventListener("pointerdown", press, true);
      window.removeEventListener("pointerup", release, true);
      window.removeEventListener("pointercancel", release, true);
      window.removeEventListener("focusout", attempt);
      stopAudio();
      stopLayers();
      window.clearTimeout(retryTimer.current);
    };
  }, [attempt]);

  const showingId = queue.showing?.id;
  useEffect(() => {
    if (!showingId) return;
    const timer = visibleTimer.current;
    timer.remaining = PEEK_VISIBLE_MS;
    timer.endsAt = performance.now() + PEEK_VISIBLE_MS;
    timer.id = window.setTimeout(foldPeek, PEEK_VISIBLE_MS);
    return () => window.clearTimeout(timer.id);
  }, [showingId]);

  const hold = useCallback(() => {
    const timer = visibleTimer.current;
    if (timer.id === undefined) return;
    window.clearTimeout(timer.id);
    timer.id = undefined;
    timer.remaining = Math.max(0, timer.endsAt - performance.now());
  }, []);

  const release = useCallback(() => {
    const timer = visibleTimer.current;
    if (timer.id !== undefined || !peekQueueSnapshot().showing) return;
    timer.endsAt = performance.now() + timer.remaining;
    timer.id = window.setTimeout(foldPeek, timer.remaining);
  }, []);

  return { queue, hold, release };
}

// -- Exports ------------------------------------------------------------------

export { useGuidePeek };
