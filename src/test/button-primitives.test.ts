import { describe, expect, it } from "vitest";
import { findProductionMatches } from "@/test/source-files";

// -- Rules --------------------------------------------------------------------

interface PrimitiveRule {
  name: string;
  pattern: RegExp;
  use: string;
  allowed: (relPath: string) => boolean;
}

// The sync header text toggle has no inactive dimming, and adding it would change how it looks.
const TOGGLE_RECIPE_EXCEPTIONS = new Set(["views/sync/sync-header.tsx"]);

const RULES: PrimitiveRule[] = [
  {
    name: 'an icon sized Button (size="icon")',
    pattern: /size="icon"/,
    use: "IconButton from @/ui/icon-button, which requires a label",
    allowed: (relPath) => relPath === "ui/icon-button.tsx",
  },
  {
    name: 'a hand-rolled toggle variant (? "primary" : "ghost")',
    pattern: /\? "primary" : "ghost"/,
    use: "ToggleButton from @/ui/toggle-button, which sets aria-pressed",
    allowed: (relPath) => relPath === "ui/toggle-button.tsx" || TOGGLE_RECIPE_EXCEPTIONS.has(relPath),
  },
];

// -- Tests --------------------------------------------------------------------

describe("button recipes go through their primitives", () => {
  for (const rule of RULES) {
    it(`has no ${rule.name} (use ${rule.use})`, () => {
      expect(findProductionMatches(rule.pattern, rule.allowed)).toEqual([]);
    });
  }

  for (const rule of RULES) {
    it(`still matches ${rule.name} inside its owner`, () => {
      expect(findProductionMatches(rule.pattern, () => false).length).toBeGreaterThan(0);
    });
  }
});
