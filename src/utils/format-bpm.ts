// -- Constants -----------------------------------------------------------------

const WHOLE_BPM_TOLERANCE = 0.15;

// -- Formatting ----------------------------------------------------------------

function formatBpm(bpm: number): string {
  const whole = Math.round(bpm);
  return Math.abs(bpm - whole) < WHOLE_BPM_TOLERANCE ? String(whole) : bpm.toFixed(1);
}

// -- Exports -------------------------------------------------------------------

export { formatBpm };
