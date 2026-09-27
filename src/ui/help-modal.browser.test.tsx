import { userEvent } from "vitest/browser";
import { useUIStore } from "@/stores/ui";
import { HELP_CONTENT_SCROLLER_CSS, installStyleSheet } from "@/test/browser-css";
import { describe, expect, it } from "vitest";
import { HelpModal } from "@/ui/help-modal";
import { render } from "@/test/render";

describe("HelpModal", () => {
  it("renders nothing when isOpen is false", async () => {
    await render(<HelpModal isOpen={false} onClose={() => {}} />);
    expect(document.querySelector("dialog")).toBeNull();
  });

  it("opens with the Help title and a sidebar of section buttons", async () => {
    const screen = await render(<HelpModal isOpen onClose={() => {}} />);
    await expect.element(screen.getByRole("heading", { name: "Help" })).toBeInTheDocument();
    const sectionButtons = document.querySelectorAll("dialog button");
    expect(sectionButtons.length).toBeGreaterThan(2);
  });

  it("switches the visible section content when a different sidebar button is clicked", async () => {
    const screen = await render(<HelpModal isOpen onClose={() => {}} />);
    const firstContent = document.querySelector("dialog")?.textContent ?? "";
    // Default active section is "Getting Started"; click another section by name.
    await screen.getByRole("button", { name: /keyboard shortcuts/i }).click();
    expect(document.querySelector("dialog")?.textContent ?? "").not.toBe(firstContent);
  });

  it("invokes onClose when Escape is pressed", async () => {
    let closeCalls = 0;
    await render(<HelpModal isOpen onClose={() => closeCalls++} />);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(closeCalls).toBeGreaterThan(0);
  });
});

describe("HelpModal initialSection", () => {
  it("opens on the requested section", async () => {
    const screen = await render(<HelpModal isOpen initialSection="best-practices" onClose={() => {}} />);
    await expect.element(screen.getByRole("heading", { name: "Lines and text", exact: true })).toBeInTheDocument();
  });

  it("falls back to getting started when no section is requested", async () => {
    const screen = await render(<HelpModal isOpen onClose={() => {}} />);
    await expect.element(screen.getByText(/Composer is the lyrics editor for/i)).toBeInTheDocument();
  });

  it("falls back to getting started when the requested section is unknown", async () => {
    const screen = await render(<HelpModal isOpen initialSection="no-such-section" onClose={() => {}} />);
    await expect.element(screen.getByText(/Composer is the lyrics editor for/i)).toBeInTheDocument();
  });

  it("still switches section when a sidebar button is clicked after opening on a section", async () => {
    const screen = await render(<HelpModal isOpen initialSection="best-practices" onClose={() => {}} />);
    await expect.element(screen.getByRole("heading", { name: "Lines and text", exact: true })).toBeInTheDocument();

    await screen.getByRole("button", { name: "Getting Started", exact: true }).click();

    await expect.element(screen.getByText(/Composer is the lyrics editor for/i)).toBeInTheDocument();
    expect(document.querySelector("dialog")?.textContent).not.toContain("Lines and text");
  });

  it("seeds any registered section, not only best practices", async () => {
    const screen = await render(<HelpModal isOpen initialSection="recovery" onClose={() => {}} />);
    await expect.element(screen.getByRole("heading", { name: "The app is frozen", exact: true })).toBeInTheDocument();
  });
});

describe("HelpModal initialScrollTop", () => {
  it("restores the content scroll position once the viewport initializes", async () => {
    installStyleSheet(HELP_CONTENT_SCROLLER_CSS);
    await render(<HelpModal isOpen initialSection="timeline" initialScrollTop={150} onClose={() => {}} />);
    const viewport = () =>
      document.querySelector("[data-help-content]")?.closest<HTMLElement>("[data-overlayscrollbars-viewport]") ?? null;
    await expect.poll(() => viewport()?.scrollTop).toBe(150);
  });

  it("regression: opens already at the saved position instead of jumping from the top", async () => {
    installStyleSheet(HELP_CONTENT_SCROLLER_CSS);
    await render(<HelpModal isOpen initialSection="timeline" initialScrollTop={150} onClose={() => {}} />);
    const content = document.querySelector("[data-help-content]");
    const scroller =
      content?.closest<HTMLElement>("[data-overlayscrollbars-viewport]") ??
      content?.closest<HTMLElement>("[data-overlayscrollbars-initialize]");
    expect(scroller?.scrollTop).toBe(150);
  });
});

describe("HelpModal search", () => {
  const openHelp = async (props: Partial<React.ComponentProps<typeof HelpModal>> = {}) => {
    const screen = await render(<HelpModal isOpen onClose={() => {}} {...props} />);
    await expect.poll(() => document.querySelector("dialog")?.contains(document.activeElement)).toBe(true);
    return screen;
  };
  const searchBox = (screen: Awaited<ReturnType<typeof openHelp>>) =>
    screen.getByRole("textbox", { name: "Search help" });
  const visibleTopics = () =>
    [...document.querySelectorAll<HTMLElement>("[data-help-topic]")]
      .filter((topic) => topic.closest("[hidden]") === null)
      .map((topic) => topic.dataset.helpTopic);

  it("shows matching topics in full, grouped by section", async () => {
    const screen = await openHelp();
    await searchBox(screen).fill("snap threshold");
    await expect.element(screen.getByRole("heading", { name: "Timeline", level: 3 })).toBeInTheDocument();
    expect(visibleTopics()).toEqual(["Snap (magnet)"]);
    await expect.element(screen.getByRole("heading", { name: "Snap (magnet)", level: 4 })).toBeVisible();
  });

  it("counts matches per section and dims the rest", async () => {
    const screen = await openHelp();
    await searchBox(screen).fill("frozen");
    await expect.element(screen.getByRole("button", { name: /^Recovery\s*\d+$/ })).toBeInTheDocument();
    await expect.element(screen.getByRole("button", { name: "About" })).toHaveAttribute("data-dimmed");
  });

  it("starts a search when a letter is typed anywhere in the modal", async () => {
    const screen = await openHelp();
    (document.querySelector("dialog") as HTMLElement).focus();
    await userEvent.keyboard("undo");
    await expect.element(searchBox(screen)).toHaveValue("undo");
  });

  it("opens a topic from the keyboard, landing on it with the nudge", async () => {
    const screen = await openHelp();
    await searchBox(screen).fill("frozen");
    (screen.getByRole("button", { name: "Open The app is frozen" }).element() as HTMLElement).focus();
    await userEvent.keyboard("{Enter}");
    await expect.element(searchBox(screen)).toHaveValue("");
    await expect.element(screen.getByRole("button", { name: "Recovery" })).toHaveAttribute("aria-current", "page");
    expect(document.querySelector('[data-help-topic="The app is frozen"]')?.hasAttribute("data-nudge")).toBe(true);
  });

  it("opens a whole section from its group header", async () => {
    const screen = await openHelp();
    await searchBox(screen).fill("snap");
    await screen.getByRole("button", { name: "Open Timeline section" }).click();
    await expect.element(searchBox(screen)).toHaveValue("");
    await expect
      .element(screen.getByRole("button", { name: "Timeline", exact: true }))
      .toHaveAttribute("aria-current", "page");
  });

  it("keeps setting links inside results working", async () => {
    const screen = await openHelp();
    await searchBox(screen).fill("snap threshold");
    await screen.getByRole("button", { name: /^Open setting Snap threshold/ }).click();
    expect(useUIStore.getState().settingsTarget).toEqual({ setting: "timelineSnapThreshold" });
  });

  it("highlights the matched words", async () => {
    const screen = await openHelp();
    await searchBox(screen).fill("frozen");
    await expect.poll(() => CSS.highlights.get("help-match")?.size ?? 0).toBeGreaterThan(0);
  });

  it("shows no matches with a clear action", async () => {
    const screen = await openHelp();
    await searchBox(screen).fill("zzzqqq");
    await expect.element(screen.getByRole("status")).toHaveTextContent('No help topics match "zzzqqq"');
    await screen.getByRole("button", { name: "Clear search" }).first().click();
    await expect.element(searchBox(screen)).toHaveValue("");
  });

  it("clears the query on Escape before closing", async () => {
    let closes = 0;
    const screen = await openHelp({ onClose: () => closes++ });
    await searchBox(screen).fill("snap");
    await userEvent.keyboard("{Escape}");
    await expect.element(searchBox(screen)).toHaveValue("");
    expect(closes).toBe(0);
    await userEvent.keyboard("{Escape}");
    expect(closes).toBe(1);
  });

  it("opens on an initial search with its results", async () => {
    const screen = await openHelp({ initialQuery: "frozen" });
    await expect.element(searchBox(screen)).toHaveValue("frozen");
    expect(visibleTopics()).toContain("The app is frozen");
  });

  it("records the search in the setting link return point", async () => {
    const screen = await openHelp();
    await searchBox(screen).fill("snap threshold");
    await screen.getByRole("button", { name: /^Open setting Snap threshold/ }).click();
    expect(useUIStore.getState().settingsReturnTo?.query).toBe("snap threshold");
  });

  describe("edge cases", () => {
    it("shows no open buttons outside search", async () => {
      const screen = await openHelp({ initialSection: "timeline" });
      await expect.element(screen.getByRole("heading", { name: "Snap (magnet)", level: 4 })).toBeInTheDocument();
      expect(document.querySelector('[aria-label^="Open Snap"]')).toBeNull();
    });

    it("matches on topic text, never on the Open buttons' own label", async () => {
      const screen = await openHelp();
      await searchBox(screen).fill("open");
      await expect.poll(() => visibleTopics().length).toBeGreaterThan(0);
      for (const topic of document.querySelectorAll<HTMLElement>("[data-help-topic]:not([hidden])")) {
        const own = topic.cloneNode(true) as HTMLElement;
        for (const ignored of own.querySelectorAll("[data-search-ignore]")) ignored.remove();
        expect(
          `${own.textContent} ${topic.closest("[data-help-section-label]")?.getAttribute("data-help-section-label")}`,
        ).toMatch(/open/i);
      }
    });

    it("clears the highlight when search ends", async () => {
      const screen = await openHelp();
      await searchBox(screen).fill("frozen");
      await expect.poll(() => CSS.highlights.has("help-match")).toBe(true);
      await searchBox(screen).fill("");
      await expect.poll(() => CSS.highlights.has("help-match")).toBe(false);
    });
  });
});
