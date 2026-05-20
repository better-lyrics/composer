type ScrubSample = { time: number; wallClockMs: number };

type ComputeScrubVelocityOpts = {
  minDtMs: number;
  minRate: number;
  maxRate: number;
  minAudible: number;
};

function computeScrubVelocity(prev: ScrubSample | null, curr: ScrubSample, opts: ComputeScrubVelocityOpts): number {
  if (!prev) return 0;
  const rawDtMs = curr.wallClockMs - prev.wallClockMs;
  const dtMs = rawDtMs > 0 ? rawDtMs : opts.minDtMs;
  const rawRate = (curr.time - prev.time) / (dtMs / 1000);
  const magnitude = Math.abs(rawRate);
  if (magnitude < opts.minAudible) return 0;
  return Math.max(opts.minRate, Math.min(opts.maxRate, magnitude));
}

export { computeScrubVelocity };
export type { ScrubSample, ComputeScrubVelocityOpts };
