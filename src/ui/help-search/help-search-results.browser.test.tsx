import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { allowConsole } from "@/test/console-guard";
import { render } from "@/test/render";
import { HelpSearchResults } from "@/ui/help-search/help-search-results";

function renderResults(terms: string[], handlers: Partial<React.ComponentProps<typeof HelpSearchResults>> = {}) {
  allowConsole(/cannot be a descendant of/);
  allowConsole(/cannot contain a nested/);
  return render(
    <HelpSearchResults
      terms={terms}
      onCounts={() => {}}
      onOpenSection={() => {}}
      onOpenTopic={() => {}}
      {...handlers}
    />,
  );
}

describe("HelpSearchResults", () => {
  it("reports the match count of every section that matched", async () => {
    let counts: Record<string, number> = {};
    await renderResults(["frozen"], {
      onCounts: (next) => {
        counts = next;
      },
    });
    expect(Object.keys(counts)).toContain("recovery");
    expect(counts.about).toBeUndefined();
  });

  it("hides the sections without matches", async () => {
    const screen = await renderResults(["frozen"]);
    await expect.element(screen.getByRole("region", { name: "Recovery" })).toBeVisible();
    expect(screen.container.querySelector<HTMLElement>('[data-help-result-section="about"]')?.hidden).toBe(true);
  });

  it("opens a topic from the keyboard with its section and title", async () => {
    const opened: string[] = [];
    const screen = await renderResults(["frozen"], {
      onOpenTopic: (section, title) => opened.push(`${section}:${title}`),
    });
    (screen.getByRole("button", { name: "Open The app is frozen" }).element() as HTMLElement).focus();
    await userEvent.keyboard("{Enter}");
    expect(opened).toEqual(["recovery:The app is frozen"]);
  });

  it("opens a section from its group header", async () => {
    const opened: string[] = [];
    const screen = await renderResults(["frozen"], { onOpenSection: (section) => opened.push(section) });
    await screen.getByRole("button", { name: "Open Recovery section" }).click();
    expect(opened).toEqual(["recovery"]);
  });

  describe("invariants", () => {
    it("refilters in place when the terms change", async () => {
      let counts: Record<string, number> = {};
      const screen = await renderResults(["frozen"], {
        onCounts: (next) => {
          counts = next;
        },
      });
      await screen.rerender(
        <HelpSearchResults
          terms={["snap"]}
          onCounts={(next) => {
            counts = next;
          }}
          onOpenSection={() => {}}
          onOpenTopic={() => {}}
        />,
      );
      expect(counts.timeline).toBeGreaterThan(0);
      expect(counts.recovery).toBeUndefined();
    });
  });
});
