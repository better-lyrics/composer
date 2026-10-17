import { scrubPreview } from "@/audio/scrub-preview";
import { useSettingsStore } from "@/stores/settings";
import { makeSineBuffer } from "@/test/audio-fixtures";
import { allowConsole } from "@/test/console-guard";
import { afterEach, describe, expect, test } from "vitest";

describe("scrub-preview", () => {
  afterEach(() => {
    scrubPreview.stop();
    scrubPreview.useBuffer(null);
  });

  test("play with no buffer is a no-op", () => {
    scrubPreview.play(0.5, 1);
    expect(scrubPreview.getActiveSnippet()).toBeNull();
  });

  test("play with buffer + audible velocity records an active snippet", () => {
    scrubPreview.useBuffer(makeSineBuffer(1));
    scrubPreview.play(0.5, 1);
    const snippet = scrubPreview.getActiveSnippet();
    expect(snippet).not.toBeNull();
    expect(snippet?.time).toBe(0.5);
    expect(snippet?.rate).toBe(1);
  });

  test("play with velocity 0 is a no-op", () => {
    scrubPreview.useBuffer(makeSineBuffer(1));
    scrubPreview.play(0.5, 0);
    expect(scrubPreview.getActiveSnippet()).toBeNull();
  });

  test("stop clears the active snippet", () => {
    scrubPreview.useBuffer(makeSineBuffer(1));
    scrubPreview.play(0.5, 1);
    scrubPreview.stop();
    expect(scrubPreview.getActiveSnippet()).toBeNull();
  });

  test("consecutive play calls swap the active snippet without throwing", () => {
    scrubPreview.useBuffer(makeSineBuffer(1));
    scrubPreview.play(0.2, 1);
    scrubPreview.play(0.4, 2);
    const snippet = scrubPreview.getActiveSnippet();
    expect(snippet?.time).toBe(0.4);
    expect(snippet?.rate).toBe(2);
  });

  test("play clamps time to within buffer duration", () => {
    scrubPreview.useBuffer(makeSineBuffer(1));
    scrubPreview.play(99, 1);
    const snippet = scrubPreview.getActiveSnippet();
    expect(snippet?.time).toBeCloseTo(1 - 0.12, 2);
  });

  test("play is a no-op when audioScrubPreview setting is off", () => {
    scrubPreview.useBuffer(makeSineBuffer(1));
    const previous = useSettingsStore.getState().audioScrubPreview;
    useSettingsStore.setState({ audioScrubPreview: false });
    try {
      scrubPreview.play(0.5, 1);
      expect(scrubPreview.getActiveSnippet()).toBeNull();
    } finally {
      useSettingsStore.setState({ audioScrubPreview: previous });
    }
  });

  describe("lazy buffer", () => {
    function countingLoader(seconds = 1): { load: () => Promise<AudioBuffer>; calls: () => number } {
      let calls = 0;
      const buffer = makeSineBuffer(seconds);
      return {
        load: async () => {
          calls += 1;
          return buffer;
        },
        calls: () => calls,
      };
    }

    test("does not load the buffer until the first scrub", async () => {
      const loader = countingLoader();
      scrubPreview.useLazyBuffer(loader.load);
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(loader.calls()).toBe(0);
    });

    test("the first scrub still plays once the buffer arrives", async () => {
      scrubPreview.useLazyBuffer(countingLoader().load);
      scrubPreview.play(0.3, 1);
      await expect.poll(() => scrubPreview.getActiveSnippet()?.time).toBe(0.3);
    });

    test("plays the latest scrub position once the buffer arrives", async () => {
      scrubPreview.useLazyBuffer(countingLoader().load);
      scrubPreview.play(0.2, 1);
      scrubPreview.play(0.6, 2);
      await expect.poll(() => scrubPreview.getActiveSnippet()).toEqual({ time: 0.6, rate: 2 });
    });

    test("loads once however many scrubs arrive while loading", async () => {
      const loader = countingLoader();
      scrubPreview.useLazyBuffer(loader.load);
      for (let i = 0; i < 5; i++) scrubPreview.play(0.1 * i, 1);
      await expect.poll(() => scrubPreview.getActiveSnippet()).not.toBeNull();
      scrubPreview.play(0.5, 1);
      expect(loader.calls()).toBe(1);
    });

    describe("edge cases", () => {
      test("stays silent when the scrub stops before the buffer arrives", async () => {
        scrubPreview.useLazyBuffer(countingLoader().load);
        scrubPreview.play(0.3, 1);
        scrubPreview.stop();
        await new Promise((resolve) => setTimeout(resolve, 50));
        expect(scrubPreview.getActiveSnippet()).toBeNull();
        scrubPreview.play(0.4, 1);
        expect(scrubPreview.getActiveSnippet()?.time).toBe(0.4);
      });

      test("does not load while scrub preview is turned off", async () => {
        const loader = countingLoader();
        scrubPreview.useLazyBuffer(loader.load);
        useSettingsStore.setState({ audioScrubPreview: false });
        try {
          scrubPreview.play(0.3, 1);
          expect(loader.calls()).toBe(0);
        } finally {
          useSettingsStore.setState({ audioScrubPreview: true });
        }
      });
    });

    describe("invariants", () => {
      test("a buffer installed during a pending load wins over the stale load", async () => {
        scrubPreview.useLazyBuffer(countingLoader(5).load);
        scrubPreview.play(0.3, 1);
        scrubPreview.useBuffer(makeSineBuffer(0.5));
        await new Promise((resolve) => setTimeout(resolve, 50));
        scrubPreview.play(99, 1);
        expect(scrubPreview.getActiveSnippet()?.time).toBeCloseTo(0.5 - 0.12, 2);
      });
    });

    describe("error paths", () => {
      test("a failed load leaves scrub silent without retrying on every scrub", async () => {
        let calls = 0;
        allowConsole(/\[ScrubPreview\]/);
        scrubPreview.useLazyBuffer(async () => {
          calls += 1;
          throw new Error("decode failed");
        });
        scrubPreview.play(0.3, 1);
        await new Promise((resolve) => setTimeout(resolve, 50));
        scrubPreview.play(0.3, 1);
        expect(scrubPreview.getActiveSnippet()).toBeNull();
        expect(calls).toBe(1);
      });
    });
  });
});
