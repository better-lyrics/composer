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
import { createFrameProbe, type FrameProbe } from "@/test/frame-probe";
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
let probe: FrameProbe;

function attachAudioElement(): HTMLAudioElement {
  const audioElement = document.createElement("audio");
  useAudioStore.getState().registerAudioElement(audioElement);
  return audioElement;
}

beforeEach(() => {
  disposeWiring = wireFrameLoop();
  probe = createFrameProbe();
});

afterEach(() => {
  probe.dispose();
  disposeWiring?.();
  disposeWiring = null;
});

// -- Tests --------------------------------------------------------------------

describe("wireFrameLoop", () => {
  describe("store wakes", () => {
    for (const [storeName, write] of WIRED_STORE_WRITES) {
      it(`wakes the loop on a ${storeName} store write`, async () => {
        expect(await probe.wokeAfter(write)).toBe(true);
      });
    }
  });

  describe("audio element", () => {
    for (const eventType of AUDIO_WAKE_EVENTS) {
      it(`wakes the loop on the audio ${eventType} event`, async () => {
        const audioElement = attachAudioElement();
        expect(await probe.wokeAfter(() => audioElement.dispatchEvent(new Event(eventType)))).toBe(true);
      });
    }

    it("stops listening to the previous element after a rebind", async () => {
      const replaced = attachAudioElement();
      const current = attachAudioElement();
      expect(await probe.wokeAfter(() => replaced.dispatchEvent(new Event("play")))).toBe(false);
      expect(await probe.wokeAfter(() => current.dispatchEvent(new Event("play")))).toBe(true);
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
      const woke = await probe.wokeAfter(() => {
        audioElement.src = URL.createObjectURL(createAudioFile());
      });
      expect(woke).toBe(true);
    });
  });

  describe("playing frame source", () => {
    it("keeps the loop live while isPlaying is true", async () => {
      await probe.quiesce();
      useAudioStore.getState().setIsPlaying(true);
      await stepFrames(LIVE_FRAMES);
      expect(probe.count()).toBeGreaterThan(TAIL_FRAMES);
      useAudioStore.getState().setIsPlaying(false);
      await settleFrames(probe.count);
    });

    it("lets the loop quiesce once isPlaying goes false", async () => {
      useAudioStore.getState().setIsPlaying(true);
      await stepFrames(LIVE_FRAMES);
      useAudioStore.getState().setIsPlaying(false);
      const settled = await settleFrames(probe.count);
      await stepFrames(30);
      expect(probe.count()).toBe(settled);
    });

    it("seeds the playing frame source when wiring starts during playback", async () => {
      disposeWiring?.();
      useAudioStore.setState({ isPlaying: true });
      disposeWiring = wireFrameLoop();
      const baseline = probe.count();
      await stepFrames(LIVE_FRAMES);
      expect(probe.count() - baseline).toBeGreaterThan(TAIL_FRAMES);
      useAudioStore.getState().setIsPlaying(false);
      await settleFrames(probe.count);
    });
  });

  describe("document visibility", () => {
    it("wakes the loop when the document becomes visible", async () => {
      expect(document.hidden).toBe(false);
      expect(await probe.wokeAfter(() => document.dispatchEvent(new Event("visibilitychange")))).toBe(true);
    });
  });

  describe("disposal", () => {
    it("removes every wake source", async () => {
      const audioElement = attachAudioElement();
      await probe.quiesce();
      disposeWiring?.();
      disposeWiring = null;

      expect(await probe.wokeAfter(() => useProjectStore.setState({ activeTab: "edit" }))).toBe(false);
      expect(await probe.wokeAfter(() => audioElement.dispatchEvent(new Event("play")))).toBe(false);
      expect(await probe.wokeAfter(() => document.dispatchEvent(new Event("visibilitychange")))).toBe(false);
    });

    it("clears the playing frame source so the loop can quiesce", async () => {
      useAudioStore.getState().setIsPlaying(true);
      await stepFrames(LIVE_FRAMES);
      disposeWiring?.();
      disposeWiring = null;
      const settled = await settleFrames(probe.count);
      await stepFrames(30);
      expect(probe.count()).toBe(settled);
    });
  });

  describe("re-entrancy", () => {
    it("keeps the surviving wiring bound when an earlier wiring is disposed", async () => {
      const audioElement = attachAudioElement();
      const disposeSecond = wireFrameLoop();
      disposeWiring?.();
      disposeWiring = disposeSecond;

      expect(await probe.wokeAfter(() => audioElement.dispatchEvent(new Event("play")))).toBe(true);
      expect(await probe.wokeAfter(() => useProjectStore.setState({ activeTab: "edit" }))).toBe(true);
    });

    it("keeps the playing hold alive when an earlier wiring is disposed mid-playback", async () => {
      const disposeSecond = wireFrameLoop();
      useAudioStore.getState().setIsPlaying(true);
      disposeWiring?.();
      disposeWiring = disposeSecond;

      const baseline = probe.count();
      await stepFrames(LIVE_FRAMES);
      expect(probe.count() - baseline).toBeGreaterThan(TAIL_FRAMES);

      useAudioStore.getState().setIsPlaying(false);
      await settleFrames(probe.count);
    });
  });

  describe("invariants", () => {
    it("a frame callback that writes to a store keeps the loop awake forever", async () => {
      await probe.quiesce();
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
      await settleFrames(probe.count);
    });
  });

  describe("regressions", () => {
    it("regression #174: with no writes and no events the loop quiesces within TAIL_FRAMES + 2 frames", async () => {
      const audioElement = attachAudioElement();
      await probe.quiesce();
      audioElement.dispatchEvent(new Event("pause"));
      const total = await settleFrames(probe.count);
      expect(total).toBeGreaterThan(0);
      expect(total).toBeLessThanOrEqual(TAIL_FRAMES + 2);
    });
  });
});
