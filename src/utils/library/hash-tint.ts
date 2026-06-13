// -- Types --------------------------------------------------------------------

const TINTS = ["lilac", "mint", "peach", "blush"] as const;
type Tint = (typeof TINTS)[number];

// -- Constants ----------------------------------------------------------------

const TINT_COLOR: Record<Tint, string> = {
  lilac: "rgb(192, 200, 250)",
  mint: "rgb(190, 230, 200)",
  peach: "rgb(250, 215, 175)",
  blush: "rgb(240, 200, 200)",
};

const TINT_BG: Record<Tint, string> = {
  lilac: "#2d2f47",
  mint: "#2a3a33",
  peach: "#3a2d20",
  blush: "#36262c",
};

// -- Functions ----------------------------------------------------------------

function hashTint(seed: string): Tint {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) | 0;
  }
  return TINTS[Math.abs(h) % TINTS.length];
}

// -- Exports ------------------------------------------------------------------

export { hashTint, TINTS, TINT_BG, TINT_COLOR };
export type { Tint };
