// -- Theme derivation ----------------------------------------------------------
// Expands a theme's explicit seeds into the full resolved token map. Alpha
// tokens flip white-on-dark vs black-on-light; shade tokens lighten/darken
// their already-resolved base. Explicit theme.tokens entries always win.

import { lighten } from "./color";
import { type ResolvedTheme, type Theme, TOKENS } from "./model";

const SEED_FALLBACK = "#ff00ff";

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
    } else {
      out[token.key] = SEED_FALLBACK;
    }
  }
  return out;
}

export { deriveTheme };
