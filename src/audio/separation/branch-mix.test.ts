import { describe, expect, it } from "vitest";
import { SEGMENT_SAMPLES } from "@/audio/separation/chunker";
import { MAGSPEC_CHANNELS, NUM_FREQ_BINS, NUM_TIME_FRAMES, computeMagspec } from "@/audio/separation/demucs-spec";
import { extractVocalsStem } from "@/audio/separation/demucs-postprocess";

// -- Constants ----------------------------------------------------------------

const NUM_STEMS = 4;
const NUM_CHANNELS = 2;
const STEM_INDEX_VOCALS = 3;
const TIME_TENSOR_LENGTH = NUM_STEMS * NUM_CHANNELS * SEGMENT_SAMPLES;
const FREQ_SOURCE_STRIDE = MAGSPEC_CHANNELS * NUM_FREQ_BINS * NUM_TIME_FRAMES;
const FREQ_TENSOR_LENGTH = NUM_STEMS * FREQ_SOURCE_STRIDE;

// -- Types --------------------------------------------------------------------

interface ImpulseSpec {
  channel: 0 | 1;
  sample: number;
  amplitude?: number;
}

interface ArgmaxResult {
  index: number;
  value: number;
}

// -- Helpers ------------------------------------------------------------------

function argmaxAbs(arr: Float32Array): ArgmaxResult {
  let index = 0;
  let value = 0;
  for (let i = 0; i < arr.length; i++) {
    const abs = Math.abs(arr[i]);
    if (abs > value) {
      value = abs;
      index = i;
    }
  }
  return { index, value };
}

function makeTimeTensor(impulses: ImpulseSpec[], stemIndex = STEM_INDEX_VOCALS): { data: Float32Array } {
  const data = new Float32Array(TIME_TENSOR_LENGTH);
  const stemStride = NUM_CHANNELS * SEGMENT_SAMPLES;
  const base = stemIndex * stemStride;
  for (const { channel, sample, amplitude = 1 } of impulses) {
    if (sample < 0 || sample >= SEGMENT_SAMPLES) {
      throw new Error(`impulse sample ${sample} out of range`);
    }
    data[base + channel * SEGMENT_SAMPLES + sample] = amplitude;
  }
  return { data };
}

function makeZeroTimeTensor(): { data: Float32Array } {
  return { data: new Float32Array(TIME_TENSOR_LENGTH) };
}

function makeZeroFreqTensor(): { data: Float32Array } {
  return { data: new Float32Array(FREQ_TENSOR_LENGTH) };
}

function makeStereoImpulseChannels(leftSample: number, rightSample: number, amplitude = 1): Float32Array[] {
  const left = new Float32Array(SEGMENT_SAMPLES);
  const right = new Float32Array(SEGMENT_SAMPLES);
  left[leftSample] = amplitude;
  right[rightSample] = amplitude;
  return [left, right];
}

function makeFreqTensorFromChannels(channels: Float32Array[], stemIndex = STEM_INDEX_VOCALS): { data: Float32Array } {
  const data = new Float32Array(FREQ_TENSOR_LENGTH);
  const magspec = computeMagspec(channels);
  const freqBase = stemIndex * FREQ_SOURCE_STRIDE;
  data.set(magspec, freqBase);
  return { data };
}

// -- Tests --------------------------------------------------------------------

describe("time-branch passthrough", () => {
  it("preserves impulse positions in left and right channels independently", () => {
    const leftPositions = [50_000, 171_990, 300_000];
    const rightPositions = [60_000, 200_000, 280_000];
    for (let trial = 0; trial < leftPositions.length; trial++) {
      const leftPos = leftPositions[trial];
      const rightPos = rightPositions[trial];
      const timeTensor = makeTimeTensor([
        { channel: 0, sample: leftPos },
        { channel: 1, sample: rightPos },
      ]);
      const freqTensor = makeZeroFreqTensor();

      const [outLeft, outRight] = extractVocalsStem(timeTensor, freqTensor);

      const peakLeft = argmaxAbs(outLeft);
      const peakRight = argmaxAbs(outRight);

      expect(Math.abs(peakLeft.index - leftPos)).toBeLessThanOrEqual(1);
      expect(Math.abs(peakRight.index - rightPos)).toBeLessThanOrEqual(1);
      expect(peakLeft.value).toBeGreaterThanOrEqual(0.99);
      expect(peakRight.value).toBeGreaterThanOrEqual(0.99);
      expect(peakLeft.value).toBeLessThanOrEqual(1.01);
      expect(peakRight.value).toBeLessThanOrEqual(1.01);
    }
  });
});

describe("freq-branch passthrough", () => {
  const positions = [50_000, 171_990, 300_000];

  for (const position of positions) {
    it(`preserves impulse at sample ${position} through freq-branch ISTFT`, () => {
      const channels = makeStereoImpulseChannels(position, position);
      const timeTensor = makeZeroTimeTensor();
      const freqTensor = makeFreqTensorFromChannels(channels);

      const [outLeft, outRight] = extractVocalsStem(timeTensor, freqTensor);

      const peakLeft = argmaxAbs(outLeft);
      const peakRight = argmaxAbs(outRight);

      const deltaLeft = peakLeft.index - position;
      const deltaRight = peakRight.index - position;

      console.log(
        `[freq-branch passthrough] position=${position} peakLeftIdx=${peakLeft.index} deltaLeft=${deltaLeft} valLeft=${peakLeft.value.toFixed(4)} peakRightIdx=${peakRight.index} deltaRight=${deltaRight} valRight=${peakRight.value.toFixed(4)}`,
      );

      expect(Math.abs(deltaLeft)).toBeLessThanOrEqual(1);
      expect(Math.abs(deltaRight)).toBeLessThanOrEqual(1);
    });
  }
});

describe("linear superposition", () => {
  it("sums time-branch and freq-branch contributions at the same position", () => {
    const position = 100_000;
    const timeAmp = 0.6;
    const freqAmp = 0.4;

    const timeTensor = makeTimeTensor([
      { channel: 0, sample: position, amplitude: timeAmp },
      { channel: 1, sample: position, amplitude: timeAmp },
    ]);
    const channels = makeStereoImpulseChannels(position, position, freqAmp);
    const freqTensor = makeFreqTensorFromChannels(channels);

    const [outLeft, outRight] = extractVocalsStem(timeTensor, freqTensor);

    const peakLeft = argmaxAbs(outLeft);
    const peakRight = argmaxAbs(outRight);

    console.log(
      `[superposition] position=${position} peakLeftIdx=${peakLeft.index} valLeft=${peakLeft.value.toFixed(4)} peakRightIdx=${peakRight.index} valRight=${peakRight.value.toFixed(4)}`,
    );

    expect(Math.abs(peakLeft.index - position)).toBeLessThanOrEqual(1);
    expect(Math.abs(peakRight.index - position)).toBeLessThanOrEqual(1);
    expect(peakLeft.value).toBeGreaterThanOrEqual(0.95);
    expect(peakLeft.value).toBeLessThanOrEqual(1.05);
    expect(peakRight.value).toBeGreaterThanOrEqual(0.95);
    expect(peakRight.value).toBeLessThanOrEqual(1.05);
  });
});

describe("isolation", () => {
  it("ignores time-branch energy in non-vocals stems", () => {
    const position = 100_000;
    const data = new Float32Array(TIME_TENSOR_LENGTH);
    const stemStride = NUM_CHANNELS * SEGMENT_SAMPLES;
    for (let stem = 0; stem < NUM_STEMS; stem++) {
      if (stem === STEM_INDEX_VOCALS) continue;
      const base = stem * stemStride;
      data[base + position] = 1;
      data[base + SEGMENT_SAMPLES + position] = 1;
    }
    const timeTensor = { data };
    const freqTensor = makeZeroFreqTensor();

    const [outLeft, outRight] = extractVocalsStem(timeTensor, freqTensor);

    expect(argmaxAbs(outLeft).value).toBe(0);
    expect(argmaxAbs(outRight).value).toBe(0);
  });

  it("ignores freq-branch energy in non-vocals stems", () => {
    const position = 100_000;
    const data = new Float32Array(FREQ_TENSOR_LENGTH);
    const channels = makeStereoImpulseChannels(position, position);
    const magspec = computeMagspec(channels);
    for (let stem = 0; stem < NUM_STEMS; stem++) {
      if (stem === STEM_INDEX_VOCALS) continue;
      data.set(magspec, stem * FREQ_SOURCE_STRIDE);
    }
    const timeTensor = makeZeroTimeTensor();
    const freqTensor = { data };

    const [outLeft, outRight] = extractVocalsStem(timeTensor, freqTensor);

    expect(argmaxAbs(outLeft).value).toBeLessThan(1e-6);
    expect(argmaxAbs(outRight).value).toBeLessThan(1e-6);
  });
});

describe("invariants", () => {
  it("emits exactly two channels each of length SEGMENT_SAMPLES", () => {
    const timeTensor = makeZeroTimeTensor();
    const freqTensor = makeZeroFreqTensor();
    const result = extractVocalsStem(timeTensor, freqTensor);
    expect(result.length).toBe(2);
    for (const channel of result) {
      expect(channel.length).toBe(SEGMENT_SAMPLES);
    }
  });

  it("silence in produces silence out", () => {
    const timeTensor = makeZeroTimeTensor();
    const freqTensor = makeZeroFreqTensor();
    const [outLeft, outRight] = extractVocalsStem(timeTensor, freqTensor);
    expect(argmaxAbs(outLeft).value).toBe(0);
    expect(argmaxAbs(outRight).value).toBe(0);
  });
});
