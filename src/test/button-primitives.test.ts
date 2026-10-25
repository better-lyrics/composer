import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { SRC_ROOT, findProductionMatches } from "@/test/source-files";
import { describe, expect, it } from "vitest";

// -- Rules --------------------------------------------------------------------

interface PrimitiveRule {
  name: string;
  pattern: RegExp;
  use: string;
  allowed: (relPath: string) => boolean;
  exceptions?: ReadonlySet<string>;
  offendingExamples: string[];
}

const TOGGLE_RECIPE_EXCEPTIONS = new Set<string>();

const RULES: PrimitiveRule[] = [
  {
    name: 'an icon sized Button (size="icon")',
    pattern: /size="icon"/,
    use: "IconButton from @/ui/icon-button, which requires a label",
    allowed: (relPath) => relPath === "ui/icon-button.tsx",
    offendingExamples: ['<Button\n  variant="ghost"\n  size="icon"\n>'],
  },
  {
    name: 'a hand-rolled toggle variant (? "latch" : "ghost")',
    pattern: /\? "(?:primary|latch)" : "ghost"/,
    use: "ToggleButton from @/ui/toggle-button, which sets aria-pressed",
    allowed: (relPath) => relPath === "ui/toggle-button.tsx" || TOGGLE_RECIPE_EXCEPTIONS.has(relPath),
    exceptions: TOGGLE_RECIPE_EXCEPTIONS,
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

    for (const exception of rule.exceptions ?? []) {
      it(`regression: the ${exception} exception to ${rule.name} is still needed`, () => {
        const path = join(SRC_ROOT, exception);
        expect(existsSync(path)).toBe(true);
        expect(readFileSync(path, "utf8")).toMatch(rule.pattern);
      });
    }
  }
});
