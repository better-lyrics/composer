// -- Constants ----------------------------------------------------------------

const UNISON_LYRIC_ID_PATTERN = /^\d+$/;

// -- Reading ------------------------------------------------------------------

function readUnisonLyricId(value: unknown): string | null {
  return typeof value === "string" && UNISON_LYRIC_ID_PATTERN.test(value) ? value : null;
}

// -- Exports ------------------------------------------------------------------

export { readUnisonLyricId };
