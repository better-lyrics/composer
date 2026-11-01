// -- Constants ----------------------------------------------------------------

const STEM_DURATION_TOLERANCE_MS = 50;

// -- Functions ----------------------------------------------------------------

function stemDurationMismatch(stemSeconds: number, songSeconds: number): number | null {
  if (songSeconds <= 0) return null;
  const difference = stemSeconds - songSeconds;
  return Math.round(Math.abs(difference) * 1000) <= STEM_DURATION_TOLERANCE_MS ? null : difference;
}

// -- Exports ------------------------------------------------------------------

export { stemDurationMismatch };
