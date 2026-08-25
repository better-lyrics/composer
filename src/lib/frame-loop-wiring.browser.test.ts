import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AUDIO_WAKE_EVENTS, wireFrameLoop } from "@/lib/frame-loop-wiring";
import { subscribeFrame, TAIL_FRAMES } from "@/lib/frame-loop";
import { useAudioStore } from "@/stores/audio";
import { useAuthStore } from "@/stores/auth";
import { useConfirmStore } from "@/stores/confirm-store";
import { useDivergenceStore } from "@/stores/divergence-store";
import { useImportModalStore } from "@/stores/import-modal-store";
import { useModalStackStore } from "@/stores/modal-stack";
import { useProjectStore } from "@/stores/project";
import { useSeparationStore } from "@/stores/separation";
import { useSettingsStore } from "@/stores/settings";
import { useShortcutBindingsStore } from "@/stores/shortcut-bindings";
import { useThemeStore } from "@/stores/theme";
import { useUIStore } from "@/stores/ui";
import { createAudioFile } from "@/test/audio-fixtures";
import { settleFrames, stepFrames } from "@/test/frame-steps";
import { useTimelineStore } from "@/views/timeline/timeline-store";

// -- Constants ----------------------------------------------------------------

const LIVE_FRAMES = TAIL_FRAMES + 6;

const WIRED_STORE_WRITES: Array<[string, () => void]> = [
  ["audio", () => useAudioStore.getState().setCurrentTime(1)],
  ["auth", () => useAuthStore.getState().setJwt("frame-loop", Date.now() + 60_000)],
  ["confirm", () => useConfirmStore.setState({ isOpen: true })],
  ["divergence", () => useDivergenceStore.setState({ isOpen: true })],
  ["import modal", () => useImportModalStore.getState().open()],
  ["modal stack", () => useModalStackStore.getState().push()],
  ["project", () => useProjectStore.setState({ activeTab: "edit" })],
  ["separation", () => useSeparationStore.setState({ modelCached: true })],
  ["settings", () => useSettingsStore.setState({ defaultZoom: 120 })],
  ["shortcut bindings", () => useShortcutBindingsStore.setState({ overrides: {} })],
  ["theme", () => useThemeStore.setState({ customThemes: [] })],
  ["ui", () => useUIStore.getState().openSettings()],
  ["timeline", () => useTimelineStore.setState({ scrollLeft: 42 })],
];

// -- Harness ------------------------------------------------------------------

let disposeWiring: (() => void) | null = null;
let unsubscribeProbe: (() => void) | null = null;
let frames = 0;

function attachAudioElement(): HTMLAudioElement {
  const audioElement = document.createElement("audio");
  useAudioStore.getState().registerAudioElement(audioElement);
  return audioElement;
}

async function quiesce(): Promise<void> {
  await settleFrames(() => frames);
  frames = 0;
}

async function wokeAfter(trigger: () => void): Promise<boolean> {
  await quiesce();
  trigger();
  await settleFrames(() => frames);
  return frames > 0;
}

beforeEach(() => {
  frames = 0;
  disposeWiring = wireFrameLoop();
  unsubscribeProbe = subscribeFrame(() => {
    frames += 1;
  }, "wiring-probe");
});

afterEach(() => {
  unsubscribeProbe?.();
  disposeWiring?.();
  unsubscribeProbe = null;
  disposeWiring = null;
});

// -- Tests --------------------------------------------------------------------

describe("wireFrameLoop", () => {
  describe("store wakes", () => {
    for (const [storeName, write] of WIRED_STORE_WRITES) {
      it(`wakes the loop on a ${storeName} store write`, async () => {
        expect(await wokeAfter(write)).toBe(true);
      });
    }
  });

  describe("audio element", () => {
    for (const eventType of AUDIO_WAKE_EVENTS) {
      it(`wakes the loop on the audio ${eventType} event`, async () => {
        const audioElement = attachAudioElement();
        expect(await wokeAfter(() => audioElement.dispatchEvent(new Event(eventType)))).toBe(true);
      });
    }

    it("stops listening to the previous element after a rebind", async () => {
      const replaced = attachAudioElement();
      const current = attachAudioElement();
      expect(await wokeAfter(() => replaced.dispatchEvent(new Event("play")))).toBe(false);
      expect(await wokeAfter(() => current.dispatchEvent(new Event("play")))).toBe(true);
    });

    it("fires loadstart when a stem switch assigns a new src", async () => {
      const audioElement = attachAudioElement();
      const observed: string[] = [];
      audioElement.addEventListener("loadstart", () => observed.push("loadstart"));
      audioElement.src = URL.createObjectURL(createAudioFile());
      await expect.poll(() => observed).toContain("loadstart");
    });

    it("wakes the loop when a stem switch assigns a new src", async () => {
      const audioElement = attachAudioElement();
      const woke = await wokeAfter(() => {
        audioElement.src = URL.createObjectURL(createAudioFile());
      });
      expect(woke).toBe(true);
    });
  });

  describe("playing frame source", () => {
    it("keeps the loop live while isPlaying is true", async () => {
      await quiesce();
      useAudioStore.getState().setIsPlaying(true);
      await stepFrames(LIVE_FRAMES);
      expect(frames).toBeGreaterThan(TAIL_FRAMES);
      useAudioStore.getState().setIsPlaying(false);
      await settleFrames(() => frames);
    });

    it("lets the loop quiesce once isPlaying goes false", async () => {
      useAudioStore.getState().setIsPlaying(true);
      await stepFrames(LIVE_FRAMES);
      useAudioStore.getState().setIsPlaying(false);
      const settled = await settleFrames(() => frames);
      await stepFrames(30);
      expect(frames).toBe(settled);
    });

    it("seeds the playing frame source when wiring starts during playback", async () => {
      disposeWiring?.();
      useAudioStore.setState({ isPlaying: true });
      disposeWiring = wireFrameLoop();
      frames = 0;
      await stepFrames(LIVE_FRAMES);
      expect(frames).toBeGreaterThan(TAIL_FRAMES);
      useAudioStore.getState().setIsPlaying(false);
      await settleFrames(() => frames);
    });
  });

  describe("document visibility", () => {
    it("wakes the loop when the document becomes visible", async () => {
      expect(document.hidden).toBe(false);
      expect(await wokeAfter(() => document.dispatchEvent(new Event("visibilitychange")))).toBe(true);
    });
  });

  describe("disposal", () => {
    it("removes every wake source", async () => {
      const audioElement = attachAudioElement();
      await quiesce();
      disposeWiring?.();
      disposeWiring = null;

      expect(await wokeAfter(() => useProjectStore.setState({ activeTab: "edit" }))).toBe(false);
      expect(await wokeAfter(() => audioElement.dispatchEvent(new Event("play")))).toBe(false);
      expect(await wokeAfter(() => document.dispatchEvent(new Event("visibilitychange")))).toBe(false);
    });

    it("clears the playing frame source so the loop can quiesce", async () => {
      useAudioStore.getState().setIsPlaying(true);
      await stepFrames(LIVE_FRAMES);
      disposeWiring?.();
      disposeWiring = null;
      const settled = await settleFrames(() => frames);
      await stepFrames(30);
      expect(frames).toBe(settled);
    });
  });

  describe("re-entrancy", () => {
    it("keeps the surviving wiring bound when an earlier wiring is disposed", async () => {
      const audioElement = attachAudioElement();
      const disposeSecond = wireFrameLoop();
      disposeWiring?.();
      disposeWiring = disposeSecond;

      expect(await wokeAfter(() => audioElement.dispatchEvent(new Event("play")))).toBe(true);
      expect(await wokeAfter(() => useProjectStore.setState({ activeTab: "edit" }))).toBe(true);
    });

    it("keeps the playing hold alive when an earlier wiring is disposed mid-playback", async () => {
      const disposeSecond = wireFrameLoop();
      useAudioStore.getState().setIsPlaying(true);
      disposeWiring?.();
      disposeWiring = disposeSecond;

      frames = 0;
      await stepFrames(LIVE_FRAMES);
      expect(frames).toBeGreaterThan(TAIL_FRAMES);

      useAudioStore.getState().setIsPlaying(false);
      await settleFrames(() => frames);
    });
  });

  describe("invariants", () => {
    it("a frame callback that writes to a store keeps the loop awake forever", async () => {
      await quiesce();
      let writes = 0;
      const unsubscribeWriter = subscribeFrame(() => {
        writes += 1;
        useTimelineStore.setState({ scrollLeft: writes });
      }, "store-writer");

      await stepFrames(30);
      const midpoint = writes;
      await stepFrames(30);

      expect(writes).toBeGreaterThan(midpoint + 20);
      unsubscribeWriter();
      await settleFrames(() => frames);
    });
  });

  describe("regressions", () => {
    it("regression #174: with no writes and no events the loop quiesces within TAIL_FRAMES + 2 frames", async () => {
      await quiesce();
      const audioElement = attachAudioElement();
      audioElement.dispatchEvent(new Event("pause"));
      frames = 0;
      const total = await settleFrames(() => frames);
      expect(total).toBeGreaterThan(0);
      expect(total).toBeLessThanOrEqual(TAIL_FRAMES + 2);
    });
  });
});
