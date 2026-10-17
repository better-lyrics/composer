import { scrubPreview } from "@/audio/scrub-preview";
import { scrubStemRouter } from "@/audio/scrub-stem-router";
import type { Stem } from "@/audio/separation/types";
import { bufferToBlobUrl, encodeWav, makeSineBuffer } from "@/test/audio-fixtures";
import { allowConsole } from "@/test/console-guard";
import { afterEach, describe, expect, test } from "vitest";

// -- Helpers ------------------------------------------------------------------

function sineWav(seconds: number): Blob {
  return new Blob([encodeWav(makeSineBuffer(seconds))], { type: "audio/wav" });
}

async function scrubAt(time: number, rate = 1): Promise<ReturnType<typeof scrubPreview.getActiveSnippet>> {
  scrubPreview.play(time, rate);
  await expect.poll(() => scrubPreview.getActiveSnippet(), { timeout: 5000 }).not.toBeNull();
  return scrubPreview.getActiveSnippet();
}

async function staysSilentAt(time: number): Promise<void> {
  scrubPreview.play(time, 1);
  await new Promise((resolve) => setTimeout(resolve, 200));
  scrubPreview.play(time, 1);
  expect(scrubPreview.getActiveSnippet()).toBeNull();
}

// -- Tests --------------------------------------------------------------------

describe("scrub-stem-router", () => {
  afterEach(() => {
    scrubStemRouter.clearCache();
    scrubPreview.stop();
    scrubPreview.useBuffer(null);
  });

  describe("happy path", () => {
    test("setOriginalSource + selectStem('original') routes to scrubPreview", async () => {
      scrubStemRouter.setOriginalSource(sineWav(1));
      scrubStemRouter.selectStem("original", () => undefined);
      expect(scrubStemRouter.getActiveStem()).toBe("original");
      expect(await scrubAt(0.5)).toEqual({ time: 0.5, rate: 1 });
    });
  });

  describe("lazy decoding", () => {
    test("does not read a stem until the first scrub", async () => {
      const vocalsUrl = bufferToBlobUrl(makeSineBuffer(1));
      scrubStemRouter.selectStem("vocals", () => vocalsUrl);
      expect(scrubStemRouter.getActiveStem()).toBe("vocals");
      URL.revokeObjectURL(vocalsUrl);

      allowConsole(/\[ScrubPreview\]/);
      await staysSilentAt(0.2);
    });

    test("reads the original source on the first scrub", async () => {
      scrubStemRouter.setOriginalSource(sineWav(1));
      expect((await scrubAt(0.2))?.time).toBe(0.2);
    });
  });

  describe("edge cases", () => {
    test("setOriginalSource(null) clears scrubPreview if original was active", async () => {
      scrubStemRouter.setOriginalSource(sineWav(1));
      scrubStemRouter.selectStem("original", () => undefined);
      expect(scrubStemRouter.getActiveStem()).toBe("original");
      scrubStemRouter.setOriginalSource(null);
      expect(scrubStemRouter.getActiveStem()).toBeNull();
      await staysSilentAt(0.5);
    });

    test("getActiveStem is null before any source is set", () => {
      expect(scrubStemRouter.getActiveStem()).toBeNull();
    });
  });

  describe("invariants", () => {
    test("setOriginalSource does not steal routing when a stem is already active", () => {
      scrubStemRouter.setOriginalSource(sineWav(1));
      scrubStemRouter.selectStem("original", () => undefined);
      const vocalsUrl = bufferToBlobUrl(makeSineBuffer(1));
      scrubStemRouter.selectStem("vocals", () => vocalsUrl);
      expect(scrubStemRouter.getActiveStem()).toBe("vocals");
      scrubStemRouter.setOriginalSource(sineWav(1));
      expect(scrubStemRouter.getActiveStem()).toBe("vocals");
      URL.revokeObjectURL(vocalsUrl);
    });

    test("clearCache resets activeStem regardless of which stem was active", () => {
      const vocalsUrl = bufferToBlobUrl(makeSineBuffer(1));
      scrubStemRouter.setOriginalSource(sineWav(1));
      scrubStemRouter.selectStem("vocals", () => vocalsUrl);
      expect(scrubStemRouter.getActiveStem()).toBe("vocals");
      scrubStemRouter.clearCache();
      expect(scrubStemRouter.getActiveStem()).toBeNull();
      URL.revokeObjectURL(vocalsUrl);
    });

    test("selectStem('original') before setOriginalSource waits, then activates on setOriginalSource", async () => {
      scrubStemRouter.selectStem("original", () => undefined);
      expect(scrubStemRouter.getActiveStem()).toBeNull();
      scrubStemRouter.setOriginalSource(sineWav(1));
      expect(scrubStemRouter.getActiveStem()).toBe("original");
      expect((await scrubAt(0.3))?.time).toBe(0.3);
    });

    test("selectStem('original') deactivates a non-original stem when original is unset", async () => {
      const vocalsUrl = bufferToBlobUrl(makeSineBuffer(1));
      scrubStemRouter.setOriginalSource(sineWav(1));
      scrubStemRouter.selectStem("vocals", () => vocalsUrl);
      expect(scrubStemRouter.getActiveStem()).toBe("vocals");

      scrubStemRouter.setOriginalSource(null);
      expect(scrubStemRouter.getActiveStem()).toBe("vocals");

      scrubStemRouter.selectStem("original", () => undefined);
      expect(scrubStemRouter.getActiveStem()).toBeNull();
      await staysSilentAt(0.5);

      URL.revokeObjectURL(vocalsUrl);
    });
  });

  describe("stem urls", () => {
    test("selectStem('vocals') fetches and decodes the URL on the first scrub", async () => {
      scrubStemRouter.setOriginalSource(sineWav(1));
      const vocalsUrl = bufferToBlobUrl(makeSineBuffer(1));

      scrubStemRouter.selectStem("vocals", () => vocalsUrl);
      expect(scrubStemRouter.getActiveStem()).toBe("vocals");
      expect(await scrubAt(0.5)).toEqual({ time: 0.5, rate: 1 });

      URL.revokeObjectURL(vocalsUrl);
    });

    test("selectStem('vocals') with no URL provider warns and stays on previous stem", () => {
      scrubStemRouter.setOriginalSource(sineWav(1));
      scrubStemRouter.selectStem("original", () => undefined);
      expect(scrubStemRouter.getActiveStem()).toBe("original");

      allowConsole(/\[ScrubStemRouter\]/);
      scrubStemRouter.selectStem("vocals", () => undefined);
      expect(scrubStemRouter.getActiveStem()).toBe("original");
    });

    test("selectStem('instrumental') routes to scrubPreview after decode", async () => {
      scrubStemRouter.setOriginalSource(sineWav(1));
      const instrUrl = bufferToBlobUrl(makeSineBuffer(1));

      scrubStemRouter.selectStem("instrumental", () => instrUrl);
      expect(scrubStemRouter.getActiveStem()).toBe("instrumental");
      expect((await scrubAt(0.2))?.time).toBe(0.2);

      URL.revokeObjectURL(instrUrl);
    });
  });

  describe("cache hit", () => {
    test("re-selecting a stem with the same URL reuses its decoded audio", async () => {
      scrubStemRouter.setOriginalSource(sineWav(1));
      const vocalsUrl = bufferToBlobUrl(makeSineBuffer(1));

      scrubStemRouter.selectStem("vocals", () => vocalsUrl);
      await scrubAt(0.1);
      URL.revokeObjectURL(vocalsUrl);

      scrubStemRouter.selectStem("original", () => undefined);
      expect(scrubStemRouter.getActiveStem()).toBe("original");

      scrubStemRouter.selectStem("vocals", () => vocalsUrl);
      expect(scrubStemRouter.getActiveStem()).toBe("vocals");
      expect((await scrubAt(0.3))?.time).toBe(0.3);
    });

    test("re-selecting the currently-active stem is a no-op (does not stop mid-scrub)", async () => {
      scrubStemRouter.setOriginalSource(sineWav(1));
      const vocalsUrl = bufferToBlobUrl(makeSineBuffer(1));

      scrubStemRouter.selectStem("vocals", () => vocalsUrl);
      const before = await scrubAt(0.5);

      scrubStemRouter.selectStem("vocals", () => vocalsUrl);
      expect(scrubPreview.getActiveSnippet()).toEqual(before);

      URL.revokeObjectURL(vocalsUrl);
    });
  });

  describe("clearCache", () => {
    test("clearCache invalidates the cache and forces a new URL on next selectStem", () => {
      scrubStemRouter.setOriginalSource(sineWav(1));
      const vocalsUrl = bufferToBlobUrl(makeSineBuffer(1));

      let urlCalls = 0;
      const getVocalsUrl = () => {
        urlCalls += 1;
        return vocalsUrl;
      };

      scrubStemRouter.selectStem("vocals", getVocalsUrl);
      expect(urlCalls).toBe(1);

      scrubStemRouter.clearCache();
      expect(scrubStemRouter.getActiveStem()).toBeNull();

      scrubStemRouter.setOriginalSource(sineWav(1));
      scrubStemRouter.selectStem("vocals", getVocalsUrl);
      expect(scrubStemRouter.getActiveStem()).toBe("vocals");
      expect(urlCalls).toBe(2);

      URL.revokeObjectURL(vocalsUrl);
    });

    test("clearCache leaves scrubPreview with no active buffer", async () => {
      scrubStemRouter.setOriginalSource(sineWav(1));
      scrubStemRouter.selectStem("original", () => undefined);
      expect(scrubStemRouter.getActiveStem()).toBe("original");

      scrubStemRouter.clearCache();
      await staysSilentAt(0.5);
    });
  });

  describe("race protection", () => {
    test("rapid switch only applies the latest selection", async () => {
      scrubStemRouter.setOriginalSource(sineWav(1));
      const vocalsUrl = bufferToBlobUrl(makeSineBuffer(5));
      const instrumentalUrl = bufferToBlobUrl(makeSineBuffer(1));

      scrubStemRouter.selectStem("vocals", () => vocalsUrl);
      scrubPreview.play(4, 1);
      scrubStemRouter.selectStem("instrumental", () => instrumentalUrl);

      expect(scrubStemRouter.getActiveStem()).toBe("instrumental");
      expect((await scrubAt(4))?.time).toBeCloseTo(1 - 0.12, 2);

      URL.revokeObjectURL(vocalsUrl);
      URL.revokeObjectURL(instrumentalUrl);
    });

    test("three rapid switches converge on the third stem", async () => {
      scrubStemRouter.setOriginalSource(sineWav(1));
      const vocalsUrl = bufferToBlobUrl(makeSineBuffer(1));
      const instrumentalUrl = bufferToBlobUrl(makeSineBuffer(1));

      scrubStemRouter.selectStem("vocals", () => vocalsUrl);
      scrubStemRouter.selectStem("instrumental", () => instrumentalUrl);
      scrubStemRouter.selectStem("original", () => undefined);

      expect(scrubStemRouter.getActiveStem()).toBe("original");

      await new Promise((resolve) => setTimeout(resolve, 200));
      expect(scrubStemRouter.getActiveStem()).toBe("original");

      URL.revokeObjectURL(vocalsUrl);
      URL.revokeObjectURL(instrumentalUrl);
    });
  });

  describe("regressions", () => {
    test("regression: re-selecting the active stem with a new URL reads the new URL", async () => {
      const revokedUrl = bufferToBlobUrl(makeSineBuffer(1));
      scrubStemRouter.selectStem("vocals", () => revokedUrl);
      URL.revokeObjectURL(revokedUrl);

      const freshUrl = bufferToBlobUrl(makeSineBuffer(1));
      scrubStemRouter.selectStem("vocals", () => freshUrl);

      expect((await scrubAt(0.4))?.time).toBe(0.4);
      URL.revokeObjectURL(freshUrl);
    });
  });

  describe("re-separation", () => {
    test("drops an inactive stem's audio once its URL is gone", async () => {
      const oldVocals = bufferToBlobUrl(makeSineBuffer(1));
      const oldInstrumental = bufferToBlobUrl(makeSineBuffer(1));
      const before: Partial<Record<Stem, string>> = { vocals: oldVocals, instrumental: oldInstrumental };
      scrubStemRouter.selectStem("vocals", (stem) => before[stem]);
      await scrubAt(0.1);
      scrubStemRouter.selectStem("instrumental", (stem) => before[stem]);
      expect(scrubStemRouter.getCachedStems().toSorted()).toEqual(["instrumental", "vocals"]);

      const newInstrumental = bufferToBlobUrl(makeSineBuffer(1));
      const after: Partial<Record<Stem, string>> = {
        vocals: bufferToBlobUrl(makeSineBuffer(1)),
        instrumental: newInstrumental,
      };
      scrubStemRouter.selectStem("instrumental", (stem) => after[stem]);

      expect(scrubStemRouter.getCachedStems()).toEqual(["instrumental"]);
      expect((await scrubAt(0.2))?.time).toBe(0.2);
      for (const url of [oldVocals, oldInstrumental, ...Object.values(after)]) if (url) URL.revokeObjectURL(url);
    });

    test("keeps the original and stems whose URL is unchanged", () => {
      const urls: Partial<Record<Stem, string>> = {
        vocals: bufferToBlobUrl(makeSineBuffer(1)),
        instrumental: bufferToBlobUrl(makeSineBuffer(1)),
      };
      scrubStemRouter.setOriginalSource(sineWav(1));
      scrubStemRouter.selectStem("vocals", (stem) => urls[stem]);
      scrubStemRouter.selectStem("instrumental", (stem) => urls[stem]);
      scrubStemRouter.selectStem("original", (stem) => urls[stem]);

      expect(scrubStemRouter.getCachedStems().toSorted()).toEqual(["instrumental", "original", "vocals"]);
      for (const url of Object.values(urls)) if (url) URL.revokeObjectURL(url);
    });
  });

  describe("decode failure", () => {
    test("a garbage stem leaves scrub silent instead of playing the wrong stem", async () => {
      scrubStemRouter.setOriginalSource(sineWav(1));
      scrubStemRouter.selectStem("original", () => undefined);

      const garbageUrl = URL.createObjectURL(new Blob([new Uint8Array([1, 2, 3, 4, 5])], { type: "audio/wav" }));
      allowConsole(/\[ScrubPreview\]/);
      scrubStemRouter.selectStem("vocals", () => garbageUrl);

      expect(scrubStemRouter.getActiveStem()).toBe("vocals");
      await staysSilentAt(0.5);

      URL.revokeObjectURL(garbageUrl);
    });

    test("a failed stem does not break scrubbing the original", async () => {
      scrubStemRouter.setOriginalSource(sineWav(1));
      scrubStemRouter.selectStem("original", () => undefined);

      const garbageUrl = URL.createObjectURL(new Blob([new Uint8Array([0, 0, 0, 0])], { type: "audio/wav" }));
      allowConsole(/\[ScrubPreview\]/);
      scrubStemRouter.selectStem("vocals", () => garbageUrl);
      await staysSilentAt(0.2);
      URL.revokeObjectURL(garbageUrl);

      scrubStemRouter.selectStem("original", () => undefined);
      expect((await scrubAt(0.3))?.time).toBe(0.3);
    });
  });
});
