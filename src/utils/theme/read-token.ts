import { type TokenKey, TOKEN_VAR } from "@/domain/theme/model";

// -- Read token ----------------------------------------------------------------
// WaveSurfer and Motion need concrete color strings, not var() references. This
// resolves a token's CSS variable to its computed value on documentElement.

function readToken(key: TokenKey): string {
  return getComputedStyle(document.documentElement).getPropertyValue(TOKEN_VAR[key]).trim();
}

// -- Exports -------------------------------------------------------------------

export { readToken };
