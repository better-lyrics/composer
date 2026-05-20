import { scrubPreview } from "@/audio/scrub-preview";
import { useSettingsStore } from "@/stores/settings";
import { makeSineBuffer } from "@/test/audio-fixtures";
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

  test("decode round-trips an ArrayBuffer into an AudioBuffer", async () => {
    const ctx = new AudioContext();
    const sourceBuffer = ctx.createBuffer(1, 44100, 44100);
    const offline = new OfflineAudioContext(1, 44100, 44100);
    const src = offline.createBufferSource();
    src.buffer = sourceBuffer;
    src.connect(offline.destination);
    src.start();
    const rendered = await offline.startRendering();
    const wavBytes = encodeWav(rendered);
    const decoded = await scrubPreview.decode(wavBytes);
    expect(decoded.duration).toBeCloseTo(1, 1);
  });
});

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
