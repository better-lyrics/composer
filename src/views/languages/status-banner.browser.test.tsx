import { languageLineAnchorId } from "@/domain/language/review";
import { render } from "@/test/render";
import { LanguageStatusBanner } from "@/views/languages/status-banner";
import { userEvent } from "vitest/browser";
import { afterEach, describe, expect, it } from "vitest";

// -- Fixtures -----------------------------------------------------------------

const items = (count: number) =>
  Array.from({ length: count }, (_, index) => ({ lineId: `l${index}`, lineIndex: index, detail: "English" }));

let farAwayAnchor: HTMLElement | null = null;

function placeAnchorFarBelow(lineId: string): HTMLElement {
  const spacer = document.createElement("div");
  spacer.style.height = "4000px";
  const anchor = document.createElement("section");
  anchor.id = languageLineAnchorId(lineId);
  anchor.textContent = "Target line";
  spacer.append(anchor);
  anchor.style.marginTop = "3500px";
  document.body.append(spacer);
  farAwayAnchor = spacer;
  return anchor;
}

afterEach(() => {
  farAwayAnchor?.remove();
  farAwayAnchor = null;
  window.scrollTo(0, 0);
});

// -- Tests --------------------------------------------------------------------

describe("LanguageStatusBanner", () => {
  it("renders title, helper, and one button per line", async () => {
    const screen = await render(
      <LanguageStatusBanner
        tone="warning"
        aria-label="Review"
        title="2 lines need review"
        helper="The lyric changed after these were written."
        items={items(2)}
      />,
    );
    await expect.element(screen.getByText("2 lines need review")).toBeInTheDocument();
    await expect.element(screen.getByText("The lyric changed after these were written.")).toBeInTheDocument();
    await expect.element(screen.getByRole("button", { name: "Go to line 1: English" })).toHaveTextContent("Line 1");
    await expect.element(screen.getByRole("button", { name: "Go to line 2: English" })).toBeInTheDocument();
  });

  it("marks its tone for styling and queries", async () => {
    const screen = await render(
      <LanguageStatusBanner
        tone="error"
        aria-label="Mismatch"
        title="1 line has a timing mismatch"
        helper="Fix the text, then press Align."
        items={items(1)}
      />,
    );
    const banner = screen.container.querySelector('[data-language-status="error"]');
    expect(banner).not.toBeNull();
    expect(banner?.className).toContain("bg-composer-error/10");
    await expect.element(screen.getByRole("complementary", { name: "Mismatch" })).toBeInTheDocument();
  });

  it("scrolls to the line when a line button is pressed", async () => {
    const screen = await render(
      <LanguageStatusBanner
        tone="warning"
        aria-label="Review"
        title="1 line needs review"
        helper="h"
        items={items(1)}
      />,
    );
    const anchor = placeAnchorFarBelow("l0");
    await expect.element(anchor).not.toBeInViewport();
    await screen.getByRole("button", { name: "Go to line 1: English" }).click();
    await expect.element(anchor).toBeInViewport();
  });

  it("scrolls to the line from the keyboard", async () => {
    const screen = await render(
      <LanguageStatusBanner
        tone="warning"
        aria-label="Review"
        title="1 line needs review"
        helper="h"
        items={items(1)}
      />,
    );
    const anchor = placeAnchorFarBelow("l0");
    await expect.element(anchor).not.toBeInViewport();
    (screen.getByRole("button", { name: "Go to line 1: English" }).element() as HTMLButtonElement).focus();
    await userEvent.keyboard("{Enter}");
    await expect.element(anchor).toBeInViewport();
  });

  describe("edge cases", () => {
    it("shows four line buttons and a +N button for the rest", async () => {
      const screen = await render(
        <LanguageStatusBanner
          tone="warning"
          aria-label="Review"
          title="6 lines need review"
          helper="h"
          items={items(6)}
        />,
      );
      expect(screen.container.querySelectorAll('button[aria-label^="Go to line"]')).toHaveLength(5);
      await expect.element(screen.getByRole("button", { name: "Go to line 5: English" })).toHaveTextContent("+2");
    });

    it("shows exactly four line buttons and no +N button at the limit", async () => {
      const screen = await render(
        <LanguageStatusBanner
          tone="warning"
          aria-label="Review"
          title="4 lines need review"
          helper="h"
          items={items(4)}
        />,
      );
      expect(screen.container.querySelectorAll('button[aria-label^="Go to line"]')).toHaveLength(4);
      expect(screen.container.textContent).not.toContain("+");
    });

    it("renders nothing without items", async () => {
      const screen = await render(
        <LanguageStatusBanner tone="warning" aria-label="Review" title="0" helper="h" items={[]} />,
      );
      expect(screen.container.querySelector("aside")).toBeNull();
    });

    it("does nothing when the line is no longer on the page", async () => {
      const screen = await render(
        <LanguageStatusBanner
          tone="warning"
          aria-label="Review"
          title="1 line needs review"
          helper="h"
          items={items(1)}
        />,
      );
      await screen.getByRole("button", { name: "Go to line 1: English" }).click();
      expect(window.scrollY).toBe(0);
    });
  });
});
