// -- Theme derivation ----------------------------------------------------------
// Expands a theme's explicit seeds into the full resolved token map. Alpha
// tokens flip white-on-dark vs black-on-light; shade tokens lighten/darken
// their already-resolved base. Explicit theme.tokens entries always win.

import { hexToRgb, lighten, relativeLuminance } from "./color";
import { type ResolvedTheme, type Theme, TOKENS } from "./model";

const SEED_FALLBACK = "#ff00ff";

// White text is the convention on a colored fill; only switch to dark text once
// the fill is genuinely light. The threshold sits above saturated accents
// (indigo lands near 0.2 to 0.35) and below pale tints (~0.45+).
const ON_ACCENT_LIGHT_THRESHOLD = 0.4;
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
      const light = relativeLuminance(hexToRgb(out[token.from])) > ON_ACCENT_LIGHT_THRESHOLD;
      out[token.key] = light ? ON_ACCENT_DARK : ON_ACCENT_LIGHT;
    } else {
      out[token.key] = SEED_FALLBACK;
    }
  }
  return out;
}

export { deriveTheme };
