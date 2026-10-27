// -- Types --------------------------------------------------------------------

type EnvelopePoint = { at: number; value: number };

interface ScrubSound {
  source: AudioBufferSourceNode;
  gain: GainNode;
  envelope: EnvelopePoint[];
  endsAt: number;
}

interface ScrubSoundOptions {
  buffer: AudioBuffer;
  offset: number;
  at: number;
  volume: number;
  fadeS: number;
  lengthS: number;
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

// Always plays at 1x: scrub audio must sound like the song.
function startScrubSound(ctx: AudioContext, options: ScrubSoundOptions): ScrubSound {
  const { buffer, offset, at, volume, fadeS, lengthS } = options;
  const source = new AudioBufferSourceNode(ctx, { buffer });
  const gain = new GainNode(ctx, { gain: 0 });
  const envelope: EnvelopePoint[] = [
    { at, value: 0 },
    { at: at + fadeS, value: volume },
    { at: at + lengthS - fadeS, value: volume },
    { at: at + lengthS, value: 0 },
  ];
  scheduleEnvelope(gain, envelope);
  source.connect(gain);
  gain.connect(ctx.destination);
  source.addEventListener("ended", () => {
    source.disconnect();
    gain.disconnect();
  });
  const endsAt = at + lengthS;
  source.start(at, offset);
  source.stop(endsAt);
  return { source, gain, envelope, endsAt };
}

// Ramps from the value scheduled for `at`, since `gain.value` lags the render thread.
function fadeOutScrubSound(sound: ScrubSound, at: number, fadeS: number): void {
  if (at + fadeS >= sound.endsAt) return;
  const from = envelopeValueAt(sound.envelope, at);
  const param = sound.gain.gain;
  param.cancelScheduledValues(at);
  if (sound.envelope.some((point) => point.at < at)) param.linearRampToValueAtTime(from, at);
  else param.setValueAtTime(from, at);
  param.linearRampToValueAtTime(0, at + fadeS);
  sound.endsAt = at + fadeS;
  sound.source.stop(sound.endsAt);
}

// -- Exports ------------------------------------------------------------------

export { fadeOutScrubSound, startScrubSound };
export type { ScrubSound };
