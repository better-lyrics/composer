import { useAudioStore } from "@/stores/audio";
import { keepWaveformData, mediaSource, readWaveformData } from "@/views/timeline/waveform-data-cache";
import { describe, expect, it } from "vitest";
import { calculateBarSegments, calculateVerticalScale } from "wavesurfer.js/dist/renderer-utils.js";

// -- Helpers ------------------------------------------------------------------

const SAMPLE_RATE = 8000;
const HALF_HEIGHT = 27;

function loudMaster(seconds: number, peak: number): Float32Array[] {
  const length = seconds * SAMPLE_RATE;
  return [0, 1].map((channel) => {
    const samples = new Float32Array(length);
    for (let i = 0; i < length; i++) {
      const t = i / SAMPLE_RATE;
      const envelope = 0.55 + 0.45 * Math.sin(2 * Math.PI * 0.5 * t + channel);
      samples[i] = envelope * (0.7 * Math.sin(2 * Math.PI * 220 * t) + 0.3 * Math.sin(2 * Math.PI * 331 * t + channel));
    }
    let max = 0;
    for (const sample of samples) max = Math.max(max, Math.abs(sample));
    for (let i = 0; i < length; i++) samples[i] *= peak / max;
    return samples;
  });
}

function bars(channelData: Float32Array[], barHeight: number | undefined, pixelsPerSample: number) {
  const vScale = calculateVerticalScale({ channelData, barHeight, normalize: false });
  return calculateBarSegments({
    channelData,
    barIndexScale: pixelsPerSample / 3,
    barSpacing: 3,
    barWidth: 2,
    halfHeight: HALF_HEIGHT,
    vScale,
    canvasHeight: HALF_HEIGHT * 2,
    barAlign: undefined,
    barMinHeight: 0,
  });
}

// -- Tests --------------------------------------------------------------------

describe("keepWaveformData", () => {
  it("keeps samples past full scale drawing the same bars as the decode at every zoom", () => {
    const decoded = loudMaster(12, 1.0186);
    const zooms = [0.004, 0.02, 0.1];
    const decodedBars = zooms.map((zoom) => bars(decoded, undefined, zoom));

    const media = new Audio("blob:http://localhost/loud-master");
    useAudioStore.getState().registerAudioElement(media);
    keepWaveformData(mediaSource(media), media, {
      numberOfChannels: 2,
      duration: 12,
      getChannelData: (channel) => decoded[channel],
    });
    const kept = readWaveformData(mediaSource(media));

    expect(kept?.peaks[0].every((sample) => sample >= -1 && sample <= 1)).toBe(true);
    expect(zooms.map((zoom) => bars(kept?.peaks ?? [], kept?.barHeight, zoom))).toEqual(decodedBars);
  });

  it("brings every channel into full scale when a later channel is the loudest", () => {
    const [quiet] = loudMaster(4, 0.8);
    const [, loud] = loudMaster(4, 1.3);
    const decoded = [quiet, loud];
    const zooms = [0.004, 0.02, 0.1];
    const decodedBars = zooms.map((zoom) => bars(decoded, undefined, zoom));

    const media = new Audio("blob:http://localhost/loud-right-channel");
    useAudioStore.getState().registerAudioElement(media);
    keepWaveformData(mediaSource(media), media, {
      numberOfChannels: 2,
      duration: 4,
      getChannelData: (channel) => decoded[channel].slice(),
    });
    const kept = readWaveformData(mediaSource(media));

    expect(kept?.peaks.every((channel) => channel.every((sample) => sample >= -1 && sample <= 1))).toBe(true);
    expect(zooms.map((zoom) => bars(kept?.peaks ?? [], kept?.barHeight, zoom))).toEqual(decodedBars);
  });

  it("regression: an instance destroyed by a stem switch never keeps its samples for the stem", () => {
    const media = new Audio("blob:http://localhost/original-mix");
    useAudioStore.getState().registerAudioElement(media);
    const original = mediaSource(media);
    media.src = "blob:http://localhost/vocal-stem";

    const decoded = loudMaster(2, 0.9);
    keepWaveformData(original, media, {
      numberOfChannels: 2,
      duration: 2,
      getChannelData: (channel) => decoded[channel],
    });

    expect(readWaveformData(mediaSource(media))).toBeNull();
    expect(readWaveformData(original)).toBeNull();
  });
});
