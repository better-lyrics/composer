import { SUPPORTED_LYRICS_FORMATS } from "@/domain/lyrics-file/supported-formats";
import { render } from "@/test/render";
import { ImportSection } from "@/ui/help-sections/importing";
import { getProviders } from "@/utils/lyrics-search/registry";
import { describe, expect, it } from "vitest";

// -- Helpers ------------------------------------------------------------------

function findSearchListItem(container: HTMLElement): HTMLLIElement {
  const item = [...container.querySelectorAll("li")].find((li) => li.textContent?.startsWith("Search"));
  if (!item) throw new Error("search list item not found");
  return item;
}

describe("ImportSection", () => {
  it("renders the section content", async () => {
    const screen = await render(<ImportSection />);
    await expect.element(screen.getByRole("heading", { name: "Audio files" })).toBeInTheDocument();
  });

  it("renders inline shortcut key badges", async () => {
    const screen = await render(<ImportSection />);
    await expect.poll(() => screen.container.querySelectorAll("[data-inline-key-badge]").length).toBeGreaterThan(0);
  });

  it("documents the Composer Bridge as an alternative YouTube backend", async () => {
    const screen = await render(<ImportSection />);
    expect(screen.container.textContent).toContain("Composer Bridge");
    expect(screen.container.textContent).toContain("http://localhost:7777");
  });

  it("lists every supported lyrics format with its description", async () => {
    const screen = await render(<ImportSection />);
    for (const format of SUPPORTED_LYRICS_FORMATS) {
      expect(screen.container.textContent).toContain(`${format.label} (${format.description})`);
    }
    expect(screen.container.textContent).toContain(".qrc (QQ Music word timing)");
  });

  it("names every registered search provider in the search description", async () => {
    const screen = await render(<ImportSection />);
    const searchItem = findSearchListItem(screen.container);
    for (const provider of getProviders()) {
      expect(searchItem.textContent).toContain(provider.sourceLabel);
    }
  });

  it("joins the provider list with an Oxford comma", async () => {
    const screen = await render(<ImportSection />);
    expect(findSearchListItem(screen.container).textContent).toContain(
      "queries LRCLib, Binimum, Better Lyrics, and Better Lyrics Portato in parallel",
    );
  });

  it("names .qrc and project files among the files the upload section accepts", async () => {
    const screen = await render(<ImportSection />);
    expect(screen.container.textContent).toContain("Accepts .txt, .lrc, .srt, .ttml, .qrc, or a project file (.json).");
  });

  it("explains that pasting a whole file into the Edit text area imports it", async () => {
    const screen = await render(<ImportSection />);
    expect(screen.container.textContent).toContain(
      "Pasting a whole lyrics file into the Edit text area imports it the same way",
    );
  });

  it("explains the choice a project file brings and that a backup only restores", async () => {
    const screen = await render(<ImportSection />);
    expect(screen.container.textContent).toContain("Use its lyrics here");
    expect(screen.container.textContent).toContain("Open as its own project");
    expect(screen.container.textContent).toContain("A backup of many projects only offers to restore it.");
  });

  it("sets the project file choice labels apart from the sentence around them", async () => {
    const screen = await render(<ImportSection />);
    const strong = [...screen.container.querySelectorAll("strong")].map((node) => node.textContent);
    expect(strong).toContain("Use its lyrics here");
    expect(strong).toContain("Open as its own project");
  });

  it("links to the composer-bridge repo", async () => {
    const screen = await render(<ImportSection />);
    const link = screen.container.querySelector('a[href="https://github.com/better-lyrics/composer-bridge"]');
    expect(link).not.toBeNull();
  });
});
