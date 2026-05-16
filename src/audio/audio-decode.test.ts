import { audioBufferToWav, isMp3File } from "@/audio/audio-decode";
import { describe, expect, it } from "vitest";

function fakeAudio(channels: number[][], sampleRate = 44100) {
  return {
    sampleRate,
    numberOfChannels: channels.length,
    length: channels[0]?.length ?? 0,
    getChannelData: (c: number) => Float32Array.from(channels[c]),
  };
}

function ascii(view: DataView, offset: number, len: number): string {
  let s = "";
  for (let i = 0; i < len; i++) s += String.fromCharCode(view.getUint8(offset + i));
  return s;
}

describe("isMp3File", () => {
  it("matches by mime type", () => {
    expect(isMp3File(new File([], "x", { type: "audio/mpeg" }))).toBe(true);
  });
  it("matches by .mp3 extension regardless of case", () => {
    expect(isMp3File(new File([], "Song.MP3"))).toBe(true);
  });
  it("rejects non-mp3 files", () => {
    expect(isMp3File(new File([], "x.wav", { type: "audio/wav" }))).toBe(false);
    expect(isMp3File(new File([], "x.opus", { type: "audio/ogg" }))).toBe(false);
  });
});

describe("audioBufferToWav", () => {
  it("writes a valid RIFF/WAVE 16-bit PCM header", async () => {
    const blob = audioBufferToWav(fakeAudio([[0, 0, 0, 0]], 48000));
    const view = new DataView(await blob.arrayBuffer());
    expect(ascii(view, 0, 4)).toBe("RIFF");
    expect(ascii(view, 8, 4)).toBe("WAVE");
    expect(ascii(view, 12, 4)).toBe("fmt ");
    expect(view.getUint16(20, true)).toBe(1); // PCM
    expect(view.getUint16(22, true)).toBe(1); // mono
    expect(view.getUint32(24, true)).toBe(48000);
    expect(view.getUint16(34, true)).toBe(16); // bit depth
    expect(ascii(view, 36, 4)).toBe("data");
    expect(view.getUint32(40, true)).toBe(8); // 4 samples * 2 bytes
    expect(blob.type).toBe("audio/wav");
  });

  it("clamps and converts float samples to 16-bit ints", async () => {
    const blob = audioBufferToWav(fakeAudio([[1, -1, 2, -2, 0]]));
    const view = new DataView(await blob.arrayBuffer());
    expect(view.getInt16(44, true)).toBe(32767);
    expect(view.getInt16(46, true)).toBe(-32768);
    expect(view.getInt16(48, true)).toBe(32767); // 2.0 clamps
    expect(view.getInt16(50, true)).toBe(-32768); // -2.0 clamps
    expect(view.getInt16(52, true)).toBe(0);
  });

  it("interleaves stereo channels L,R,L,R", async () => {
    const blob = audioBufferToWav(
      fakeAudio([
        [1, 0],
        [0, -1],
      ]),
    );
    const view = new DataView(await blob.arrayBuffer());
    expect(view.getUint16(22, true)).toBe(2); // stereo
    expect(view.getInt16(44, true)).toBe(32767); // L0
    expect(view.getInt16(46, true)).toBe(0); // R0
    expect(view.getInt16(48, true)).toBe(0); // L1
    expect(view.getInt16(50, true)).toBe(-32768); // R1
  });
});
