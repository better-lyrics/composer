// -- Types --------------------------------------------------------------------

type EnvelopePoint = { at: number; value: number };

interface ScrubSound {
  source: AudioBufferSourceNode;
  gain: GainNode;
  envelope: EnvelopePoint[];
}

interface ScrubSoundOptions {
  buffer: AudioBuffer;
  offset: number;
  at: number;
  volume: number;
  rate: number;
  fadeS: number;
  lengthS?: number;
}

// -- Functions ----------------------------------------------------------------

function envelopeValueAt(envelope: EnvelopePoint[], at: number): number {
  let previous: EnvelopePoint | null = null;
  for (const point of envelope) {
    if (point.at > at) {
      if (!previous) return point.value;
      const progress = (at - previous.at) / (point.at - previous.at);
      return previous.value + (point.value - previous.value) * progress;
    }
    previous = point;
  }
  return previous?.value ?? 0;
}

function scheduleEnvelope(gain: GainNode, envelope: EnvelopePoint[]): void {
  const [first, ...rest] = envelope;
  gain.gain.setValueAtTime(first.value, first.at);
  for (const point of rest) gain.gain.linearRampToValueAtTime(point.value, point.at);
}

function startScrubSound(ctx: AudioContext, options: ScrubSoundOptions): ScrubSound {
  const { buffer, offset, at, volume, rate, fadeS, lengthS } = options;
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.playbackRate.setValueAtTime(rate, at);
  const gain = ctx.createGain();
  const envelope: EnvelopePoint[] = [
    { at, value: 0 },
    { at: at + fadeS, value: volume },
  ];
  if (lengthS !== undefined) {
    envelope.push({ at: at + lengthS - fadeS, value: volume }, { at: at + lengthS, value: 0 });
  }
  scheduleEnvelope(gain, envelope);
  source.connect(gain);
  gain.connect(ctx.destination);
  source.start(at, offset);
  if (lengthS !== undefined) source.stop(at + lengthS);
  return { source, gain, envelope };
}

// Fades from the value the envelope holds at `at`, never from `gain.value`, which lags the render thread.
function fadeOutScrubSound(sound: ScrubSound, at: number, fadeS: number): void {
  const from = envelopeValueAt(sound.envelope, at);
  sound.envelope = [
    { at, value: from },
    { at: at + fadeS, value: 0 },
  ];
  sound.gain.gain.cancelScheduledValues(at);
  scheduleEnvelope(sound.gain, sound.envelope);
  sound.source.stop(at + fadeS);
}

// -- Exports ------------------------------------------------------------------

export { fadeOutScrubSound, startScrubSound };
export type { ScrubSound };
