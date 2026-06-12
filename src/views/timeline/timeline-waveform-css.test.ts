import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const INDEX_CSS = readFileSync(resolve(__dirname, "../../index.css"), "utf-8");

describe("timeline waveform background rule in index.css", () => {
  it("ships a ::part(scroll) rule scoped to [data-waveform-host]", () => {
    const ruleStart = INDEX_CSS.indexOf("[data-waveform-host]");
    expect(ruleStart).toBeGreaterThanOrEqual(0);

    const closingBrace = INDEX_CSS.indexOf("}", ruleStart);
    const block = INDEX_CSS.slice(ruleStart, closingBrace + 1);
    expect(block).toContain("::part(scroll)");
    expect(block).toContain("background-color");
  });

  it("uses the composer-bg theme token so the color tracks the rest of the app", () => {
    const ruleStart = INDEX_CSS.indexOf("[data-waveform-host]");
    const closingBrace = INDEX_CSS.indexOf("}", ruleStart);
    const block = INDEX_CSS.slice(ruleStart, closingBrace + 1);
    expect(block).toContain("var(--color-composer-bg)");
  });

  it("does not pin a literal hex color (regression: must not drift from the token)", () => {
    const ruleStart = INDEX_CSS.indexOf("[data-waveform-host]");
    const closingBrace = INDEX_CSS.indexOf("}", ruleStart);
    const block = INDEX_CSS.slice(ruleStart, closingBrace + 1);
    expect(block).not.toMatch(/#28292c/i);
  });
});
