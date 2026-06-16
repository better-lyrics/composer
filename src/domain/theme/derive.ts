// -- Theme derivation ----------------------------------------------------------
// Expands a theme's explicit seeds into the full resolved token map. Alpha
// tokens flip white-on-dark vs black-on-light; shade tokens lighten/darken
// their already-resolved base. Explicit theme.tokens entries always win.

import { contrastRatio, lighten } from "@/domain/theme/color";
import { type ResolvedTheme, type Theme, TOKENS } from "@/domain/theme/model";

const SEED_FALLBACK = "#ff00ff";

// Pick whichever of near-white / near-black reads better on the accent fill.
const ON_ACCENT_DARK = "#15161a";
const ON_ACCENT_LIGHT = "#ffffff";

function deriveTheme(theme: Theme): ResolvedTheme {
  const fg = theme.scheme === "dark" ? "255, 255, 255" : "0, 0, 0";
  const out = {} as ResolvedTheme;
  for (const token of TOKENS) {
    const explicit = theme.tokens[token.key];
    if (explicit) {
      out[token.key] = explicit;
      continue;
    }
    if (token.type === "alpha") {
      const base = token.on === "shadow" ? "0, 0, 0" : fg;
      out[token.key] = `rgba(${base}, ${token.alpha})`;
    } else if (token.type === "shade" && token.from) {
      out[token.key] = lighten(out[token.from], token.lighten ?? 0);
    } else if (token.type === "contrast" && token.from) {
      const base = out[token.from];
      out[token.key] =
        contrastRatio(ON_ACCENT_LIGHT, base) >= contrastRatio(ON_ACCENT_DARK, base) ? ON_ACCENT_LIGHT : ON_ACCENT_DARK;
    } else {
      out[token.key] = SEED_FALLBACK;
    }
  }
  return out;
}

export { deriveTheme };
