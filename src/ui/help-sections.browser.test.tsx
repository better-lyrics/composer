import { describe, expect, it } from "vitest";
import { HelpSectionContent } from "@/ui/help-sections";
import { render } from "@/test/render";

const SECTION_IDS = [
  "getting-started",
  "keyboard-shortcuts",
  "importing",
  "editing",
  "syncing",
  "timeline",
  "groups",
  "preview",
  "exporting",
  "ttml-standards",
] as const;

describe("HelpSectionContent", () => {
  for (const id of SECTION_IDS) {
    it(`renders the "${id}" section without throwing`, async () => {
      const screen = await render(<HelpSectionContent section={id} />);
      expect(screen.container.textContent ?? "").not.toBe("");
    });
  }

  it("falls back to the getting-started section for an unknown id", async () => {
    const screen = await render(<HelpSectionContent section="not-a-real-section" />);
    expect(screen.container.textContent ?? "").not.toBe("");
  });
});
