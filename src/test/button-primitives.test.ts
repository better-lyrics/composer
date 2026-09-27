import { describe, expect, it } from "vitest";
import { findProductionMatches } from "@/test/source-files";

// -- Rules --------------------------------------------------------------------

interface PrimitiveRule {
  name: string;
  pattern: RegExp;
  use: string;
  allowed: (relPath: string) => boolean;
  offendingExamples: string[];
}

// The sync header text toggle has no inactive dimming, and adding it would change how it looks.
const TOGGLE_RECIPE_EXCEPTIONS = new Set(["views/sync/sync-header.tsx"]);

const RULES: PrimitiveRule[] = [
  {
    name: 'an icon sized Button (size="icon")',
    pattern: /size="icon"/,
    use: "IconButton from @/ui/icon-button, which requires a label",
    allowed: (relPath) => relPath === "ui/icon-button.tsx",
    offendingExamples: ['<Button\n  variant="ghost"\n  size="icon"\n>'],
  },
  {
    name: 'a hand-rolled toggle variant (? "primary" : "ghost")',
    pattern: /\? "primary" : "ghost"/,
    use: "ToggleButton from @/ui/toggle-button, which sets aria-pressed",
    allowed: (relPath) => relPath === "ui/toggle-button.tsx" || TOGGLE_RECIPE_EXCEPTIONS.has(relPath),
    offendingExamples: ['variant={active ? "primary" : "ghost"}'],
  },
  {
    name: "a Button wrapped in a link (<Link><Button> or <a><Button>)",
    pattern: /<(?:Link\b|a\s)(?:[^>{]|\{(?:[^{}]|\{[^{}]*\})*\})*>\s*<Button\b/,
    use: "LinkButton from @/ui/link-button, which renders one anchor",
    allowed: () => false,
    offendingExamples: [
      '<Link to={cta.to}>\n  <Button variant="primary">',
      '<a href={href} className="x">\n  <Button size="sm">',
      '<a href={href} onClick={() => track()}>\n  <Button size="sm">',
      '<Link to="/app" style={{ opacity: a > b ? 1 : 0 }}>\n  <Button>',
    ],
  },
];

// -- Tests --------------------------------------------------------------------

describe("button recipes go through their primitives", () => {
  for (const rule of RULES) {
    it(`has no ${rule.name} (use ${rule.use})`, () => {
      expect(findProductionMatches(rule.pattern, rule.allowed)).toEqual([]);
    });

    it(`recognises ${rule.name}`, () => {
      for (const example of rule.offendingExamples) expect(example).toMatch(rule.pattern);
    });
  }
});
