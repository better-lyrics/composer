import { describe, expect, it } from "vitest";
import { allowConsole } from "@/test/console-guard";
import { render } from "@/test/render";
import { HELP_SECTIONS } from "@/ui/help-nav";
import { HelpSectionContent } from "@/ui/help-sections";
import { HelpTopic } from "@/ui/help-topic";

const topicTitles = (container: HTMLElement) =>
  [...container.querySelectorAll<HTMLElement>("[data-help-topic]")].map((topic) => topic.dataset.helpTopic);

describe("HelpTopic", () => {
  it("renders its title as a heading above the content", async () => {
    const screen = await render(
      <HelpTopic title="Snap (magnet)">
        <p>Drag a word.</p>
      </HelpTopic>,
    );
    await expect.element(screen.getByRole("heading", { name: "Snap (magnet)", level: 4 })).toBeInTheDocument();
    expect(topicTitles(screen.container)).toEqual(["Snap (magnet)"]);
  });

  it("can leave the heading to its content", async () => {
    const screen = await render(
      <HelpTopic title="Global" showTitle={false}>
        <h3>Global</h3>
      </HelpTopic>,
    );
    expect(screen.container.querySelector("h4")).toBeNull();
    expect(topicTitles(screen.container)).toEqual(["Global"]);
  });

  describe("invariants", () => {
    it("positions the topic so the nudge overlay anchors to it", async () => {
      const screen = await render(<HelpTopic title="Layout">text</HelpTopic>);
      expect(screen.container.querySelector("[data-help-topic]")?.className).toContain("relative");
    });
  });
});

describe("Help sections as topics", () => {
  for (const { id } of HELP_SECTIONS) {
    it(`splits ${id} into uniquely titled topics that hold every subheading`, async () => {
      allowConsole(/cannot be a descendant of/);
      allowConsole(/cannot contain a nested/);
      const screen = await render(<HelpSectionContent section={id} />);
      const titles = topicTitles(screen.container);
      expect(titles.length).toBeGreaterThan(0);
      expect(new Set(titles).size).toBe(titles.length);
      for (const heading of screen.container.querySelectorAll("h4")) {
        expect(heading.closest("[data-help-topic]"), heading.textContent ?? "").not.toBeNull();
      }
    });
  }
});
