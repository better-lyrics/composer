import { scrubPreview } from "@/audio/scrub-preview";
import { scrubStemRouter } from "@/audio/scrub-stem-router";
import { makeSineBuffer } from "@/test/audio-fixtures";
import { afterEach, describe, expect, test } from "vitest";

describe("scrub-stem-router", () => {
  afterEach(() => {
    scrubStemRouter.clearCache();
    scrubPreview.stop();
    scrubPreview.useBuffer(null);
  });

  describe("happy path", () => {
    test("setOriginalBuffer + selectStem('original') routes to scrubPreview", () => {
      const buf = makeSineBuffer(1);
      scrubStemRouter.setOriginalBuffer(buf);
      scrubStemRouter.selectStem("original", () => undefined);
      expect(scrubStemRouter.getActiveStem()).toBe("original");
      scrubPreview.play(0.5, 1);
      const snippet = scrubPreview.getActiveSnippet();
      expect(snippet).not.toBeNull();
      expect(snippet?.time).toBe(0.5);
      expect(snippet?.rate).toBe(1);
    });
  });

  describe("edge cases", () => {
    test("setOriginalBuffer(null) clears scrubPreview if original was active", () => {
      const buf = makeSineBuffer(1);
      scrubStemRouter.setOriginalBuffer(buf);
      scrubStemRouter.selectStem("original", () => undefined);
      expect(scrubStemRouter.getActiveStem()).toBe("original");
      scrubStemRouter.setOriginalBuffer(null);
      expect(scrubStemRouter.getActiveStem()).toBeNull();
      scrubPreview.play(0.5, 1);
      expect(scrubPreview.getActiveSnippet()).toBeNull();
    });

    test("getActiveStem is null before any buffer is set", () => {
      expect(scrubStemRouter.getActiveStem()).toBeNull();
    });
  });

  describe("invariants", () => {
    test("setOriginalBuffer does not steal routing when a stem is already active", async () => {
      const vocalsBuf = makeSineBuffer(1);
      scrubStemRouter.setOriginalBuffer(makeSineBuffer(1));
      scrubStemRouter.selectStem("original", () => undefined);
      const vocalsUrl = bufferToBlobUrl(vocalsBuf);
      scrubStemRouter.selectStem("vocals", () => vocalsUrl);
      await expect.poll(() => scrubStemRouter.getActiveStem(), { timeout: 5000 }).toBe("vocals");
      scrubStemRouter.setOriginalBuffer(makeSineBuffer(1));
      expect(scrubStemRouter.getActiveStem()).toBe("vocals");
      URL.revokeObjectURL(vocalsUrl);
    });

    test("clearCache resets activeStem regardless of which stem was active", async () => {
      const vocalsBuf = makeSineBuffer(1);
      const vocalsUrl = bufferToBlobUrl(vocalsBuf);
      scrubStemRouter.setOriginalBuffer(makeSineBuffer(1));
      scrubStemRouter.selectStem("vocals", () => vocalsUrl);
      await expect.poll(() => scrubStemRouter.getActiveStem(), { timeout: 5000 }).toBe("vocals");
      scrubStemRouter.clearCache();
      expect(scrubStemRouter.getActiveStem()).toBeNull();
      URL.revokeObjectURL(vocalsUrl);
    });

    test("selectStem('original') before setOriginalBuffer waits, then activates on setOriginalBuffer", () => {
      scrubStemRouter.selectStem("original", () => undefined);
      expect(scrubStemRouter.getActiveStem()).toBeNull();
      const buf = makeSineBuffer(1);
      scrubStemRouter.setOriginalBuffer(buf);
      expect(scrubStemRouter.getActiveStem()).toBe("original");
      scrubPreview.play(0.3, 1);
      expect(scrubPreview.getActiveSnippet()?.time).toBe(0.3);
    });
  });
});

function bufferToBlobUrl(audioBuffer: AudioBuffer): string {
  const wavBytes = encodeWav(audioBuffer);
  const blob = new Blob([wavBytes], { type: "audio/wav" });
  return URL.createObjectURL(blob);
}

function encodeWav(audioBuffer: AudioBuffer): ArrayBuffer {
  const channelCount = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const samples = audioBuffer.length;
  const dataLength = samples * channelCount * 2;
  const buffer = new ArrayBuffer(44 + dataLength);
  const view = new DataView(buffer);
  const writeString = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
  };
  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataLength, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channelCount, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channelCount * 2, true);
  view.setUint16(32, channelCount * 2, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, dataLength, true);
  const channels = Array.from({ length: channelCount }, (_, c) => audioBuffer.getChannelData(c));
  let offset = 44;
  for (let i = 0; i < samples; i++) {
    for (let c = 0; c < channelCount; c++) {
      const sample = Math.max(-1, Math.min(1, channels[c][i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }
  return buffer;
}
