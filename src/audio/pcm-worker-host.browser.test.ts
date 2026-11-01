import { detectVocalOnsets, mixToMono } from "@/audio/onset-detection";
import { detectOnsetsOffThread, encodeWavOffThread } from "@/audio/pcm-worker-host";
import { hashFile } from "@/audio/separation/audio-codec";
import { GOLDEN_STEREO_WAV_SHA256, goldenStereoInput } from "@/test/wav-golden";
import { describe, expect, it } from "vitest";

const SAMPLE_RATE = 44_100;

function burstyChannel(seconds: number, phase: number): Float32Array {
  const channel = new Float32Array(Math.floor(seconds * SAMPLE_RATE));
  for (let start = 0.25; start < seconds - 0.3; start += 0.4) {
    const offset = Math.floor((start + phase) * SAMPLE_RATE);
    for (let i = 0; i < 4000; i++) {
      channel[offset + i] = 0.3 * Math.min(1, i / 64) * Math.sin((2 * Math.PI * (900 + start * 300) * i) / SAMPLE_RATE);
    }
  }
  return channel;
}

describe("detectOnsetsOffThread", () => {
  it("returns the same onsets as detecting on the main thread", async () => {
    const channels = [burstyChannel(3, 0), burstyChannel(3, 0.01)];
    const expected = detectVocalOnsets(mixToMono(channels), { sampleRate: SAMPLE_RATE });
    expect(expected.length).toBeGreaterThan(3);

    await expect(detectOnsetsOffThread(channels, SAMPLE_RATE)).resolves.toEqual(expected);
  });

  it("transfers the channel buffers to the worker instead of copying them", async () => {
    const channels = [burstyChannel(1, 0), burstyChannel(1, 0)];
    const pending = detectOnsetsOffThread(channels, SAMPLE_RATE);
    expect(channels.map((channel) => channel.byteLength)).toEqual([0, 0]);
    await pending;
  });

  describe("edge cases", () => {
    it("returns no onsets for empty audio", async () => {
      await expect(detectOnsetsOffThread([new Float32Array(0)], SAMPLE_RATE)).resolves.toEqual([]);
    });
  });

  describe("error paths", () => {
    it("rejects with an AbortError when aborted mid-detection", async () => {
      const controller = new AbortController();
      const pending = detectOnsetsOffThread([burstyChannel(20, 0)], SAMPLE_RATE, controller.signal);
      controller.abort();
      await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    });

    it("rejects without starting a worker when the signal is already aborted", async () => {
      const controller = new AbortController();
      controller.abort();
      const channel = burstyChannel(1, 0);
      await expect(detectOnsetsOffThread([channel], SAMPLE_RATE, controller.signal)).rejects.toMatchObject({
        name: "AbortError",
      });
      expect(channel.byteLength).toBeGreaterThan(0);
    });
  });
});

describe("encodeWavOffThread", () => {
  it("returns a wav blob with the same bytes as before the worker move", async () => {
    const { channels, sampleRate } = goldenStereoInput();
    const wav = await encodeWavOffThread(channels, sampleRate);
    expect(wav.type).toBe("audio/wav");
    expect(await hashFile(wav)).toBe(GOLDEN_STEREO_WAV_SHA256);
  });

  it("transfers the channel buffers to the worker instead of copying them", async () => {
    const { channels, sampleRate } = goldenStereoInput();
    const pending = encodeWavOffThread(channels, sampleRate);
    expect(channels.map((channel) => channel.byteLength)).toEqual([0, 0]);
    await pending;
  });

  describe("edge cases", () => {
    it("encodes empty audio as a header-only wav", async () => {
      expect((await encodeWavOffThread([new Float32Array(0)], 44_100)).size).toBe(44);
    });
  });
});
