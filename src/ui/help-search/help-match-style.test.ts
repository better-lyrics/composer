import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { HELP_MATCH_HIGHLIGHT } from "@/ui/help-search/filter-help-topics";

const INDEX_CSS = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "../../index.css"), "utf8");

describe("help match highlight style", () => {
  it("regression: styles the highlight that paintHelpMatches registers, or matches stay invisible", () => {
    expect(INDEX_CSS).toContain(`::highlight(${HELP_MATCH_HIGHLIGHT})`);
  });
});
