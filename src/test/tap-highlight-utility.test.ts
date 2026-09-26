import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Guarded at the source level rather than via getComputedStyle because the
// browser test project registers no Tailwind plugin and imports no stylesheet,
// so computed styles there are UA defaults and would never see this rule.

const INDEX_CSS = join(resolve(dirname(fileURLToPath(import.meta.url)), ".."), "index.css");
const UTILITY_NAME = "tap-highlight-none";

function extractUtilityBlock(css: string, name: string): string | null {
  const header = new RegExp(`@utility\\s+${name}\\s*\\{`).exec(css);
  if (!header) return null;

  const bodyStart = header.index + header[0].length;
  let depth = 1;
  for (let i = bodyStart; i < css.length; i++) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}") {
      depth--;
      if (depth === 0) return css.slice(bodyStart, i);
    }
  }
  return null;
}

const UTILITY_BODY = extractUtilityBlock(readFileSync(INDEX_CSS, "utf8"), UTILITY_NAME);
const DECLARATIONS = UTILITY_BODY ?? `<no @utility ${UTILITY_NAME} block in src/index.css>`;

describe("tap-highlight-none utility", () => {
  it("is declared as an @utility block in src/index.css", () => {
    expect(UTILITY_BODY).not.toBeNull();
  });

  it("suppresses the mobile tap highlight rectangle", () => {
    expect(DECLARATIONS).toMatch(/-webkit-tap-highlight-color:\s*transparent\s*;/);
  });

  it("suppresses the iOS long-press callout", () => {
    expect(DECLARATIONS).toMatch(/-webkit-touch-callout:\s*none\s*;/);
  });
});
