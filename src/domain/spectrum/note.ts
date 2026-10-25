// -- Constants -------------------------------------------------------------

const NOTE_NAMES = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];

// -- Types -----------------------------------------------------------------

interface NoteReading {
  name: string;
  cents: number;
}

// -- Functions -------------------------------------------------------------

function noteOfFrequency(hz: number): NoteReading | null {
  if (!Number.isFinite(hz) || hz <= 0) return null;
  const midi = 69 + 12 * Math.log2(hz / 440);
  const nearest = Math.round(midi);
  return {
    name: `${NOTE_NAMES[((nearest % 12) + 12) % 12]}${Math.floor(nearest / 12) - 1}`,
    cents: Math.round((midi - nearest) * 100),
  };
}

// -- Exports ---------------------------------------------------------------

export { noteOfFrequency };
export type { NoteReading };
