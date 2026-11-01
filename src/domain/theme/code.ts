// -- Share codes ---------------------------------------------------------------
// A compact, copy-pasteable representation of a theme's seeds. Format:
//   ctm1:<scheme>:<encodeURIComponent(name)>:<seedHex,seedHex,...>
// Seed order follows SEED_CODE_ORDER; hexes are stored without the leading #.

import { isHexColor } from "@/domain/theme/color";
import type { Theme, TokenKey } from "@/domain/theme/model";

// Slot index IS the ctm1 wire format. Never reorder or remove an entry: codes
// already in the wild decode positionally against this list. New seeds append
// to the end, where older builds simply ignore them.
const SEED_CODE_ORDER: TokenKey[] = [
  "bg",
  "bg-dark",
  "bg-elevated",
  "text",
  "text-tertiary",
  "text-faint",
  "accent",
  "accent-warm",
  "link",
  "error",
  "error-text",
  "warning",
  "explicit",
  "wave",
  "snap",
  "onset",
  "positive",
  "negative",
];

const CODE_PATTERN = /^ctm1:(dark|light):([^:]*):(.+)$/;
const DEFAULT_IMPORT_NAME = "Imported theme";

function encodeThemeCode(theme: Theme): string {
  const seeds = SEED_CODE_ORDER.map((key) => (theme.tokens[key] ?? "").replace("#", "")).join(",");
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
  SEED_CODE_ORDER.forEach((key, index) => {
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

export { encodeThemeCode, decodeThemeCode, SEED_CODE_ORDER };
