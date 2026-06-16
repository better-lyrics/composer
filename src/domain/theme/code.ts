// -- Share codes ---------------------------------------------------------------
// A compact, copy-pasteable representation of a theme's seeds. Format:
//   ctm1:<scheme>:<encodeURIComponent(name)>:<seedHex,seedHex,...>
// Seed order follows SEED_TOKENS; hexes are stored without the leading #.

import { isHexColor } from "@/domain/theme/color";
import { SEED_TOKENS, type Theme } from "@/domain/theme/model";

const CODE_PATTERN = /^ctm1:(dark|light):([^:]*):(.+)$/;
const DEFAULT_IMPORT_NAME = "Imported theme";

function encodeThemeCode(theme: Theme): string {
  const seeds = SEED_TOKENS.map((key) => (theme.tokens[key] ?? "").replace("#", "")).join(",");
  return `ctm1:${theme.scheme}:${encodeURIComponent(theme.name)}:${seeds}`;
}

function decodeThemeCode(code: string, makeId: () => string): Theme {
  const match = code.trim().match(CODE_PATTERN);
  if (!match) {
    throw new Error("Unrecognized theme code. Expected a string starting with ctm1:.");
  }
  const scheme = match[1] === "light" ? "light" : "dark";
  const name = match[2] ? decodeURIComponent(match[2]) : DEFAULT_IMPORT_NAME;
  const hexes = match[3].split(",");
  const tokens: Theme["tokens"] = {};
  SEED_TOKENS.forEach((key, index) => {
    const hex = hexes[index];
    if (!hex) return;
    const candidate = `#${hex.replace("#", "")}`;
    if (isHexColor(candidate)) {
      tokens[key] = candidate;
    }
  });
  return {
    id: makeId(),
    name,
    kind: "custom",
    scheme,
    desc: "Imported from a code.",
    tokens,
  };
}

export { encodeThemeCode, decodeThemeCode };
