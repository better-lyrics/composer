import { TEXT_COLOR_UTILITIES_CSS, THEME_TOKENS_CSS, installStyleSheet } from "@/test/browser-css";
import { render } from "@/test/render";
import { ProjectArt } from "@/ui/projects/project-art";
import { afterEach, describe, expect, it } from "vitest";

const PIXEL = "data:image/gif;base64,R0lGODlhAQABAAAAACw=";

describe("ProjectArt", () => {
  it("shows the cover image when there is one", async () => {
    const screen = await render(<ProjectArt src={PIXEL} size="md" />);
    const image = screen.container.querySelector("img");
    expect(image?.getAttribute("src")).toBe(PIXEL);
    expect(image?.getAttribute("alt")).toBe("");
  });

  it("shows a music placeholder without a cover", async () => {
    const screen = await render(<ProjectArt size="sm" />);
    expect(screen.container.querySelector("img")).toBeNull();
    expect(screen.container.querySelector("svg")).not.toBeNull();
  });

  describe("invariants", () => {
    const sheets: HTMLStyleElement[] = [];
    afterEach(() => {
      for (const sheet of sheets.splice(0)) sheet.remove();
    });

    it("regression: paints the placeholder icon in an opaque color and fades it with opacity", async () => {
      sheets.push(installStyleSheet(THEME_TOKENS_CSS), installStyleSheet(TEXT_COLOR_UTILITIES_CSS));
      const screen = await render(<ProjectArt size="row" />);
      const icon = screen.container.querySelector("svg");
      if (!icon) throw new Error("placeholder icon missing");
      expect(getComputedStyle(icon).color).toBe("rgb(255, 255, 255)");
      expect(getComputedStyle(icon).opacity).toBe("0.5");
    });

    it("hides the placeholder icon from assistive technology", async () => {
      const screen = await render(<ProjectArt size="md" />);
      expect(screen.container.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
    });
  });

  it("renders each library size with the image or the music placeholder", async () => {
    const frameClassBySize = {
      xs: "size-7",
      row: "size-10",
      dialog: "size-12",
      hero: "size-30",
      card: "aspect-square",
    } as const;
    for (const size of ["xs", "row", "dialog", "hero", "card"] as const) {
      const screen = await render(<ProjectArt src={PIXEL} size={size} />);
      expect(screen.container.querySelector("img")?.getAttribute("loading")).toBe("lazy");
      expect(screen.container.firstElementChild?.classList.contains(frameClassBySize[size])).toBe(true);
      await screen.unmount();
    }
    const placeholder = await render(<ProjectArt size="card" />);
    expect(placeholder.container.querySelector("svg")).not.toBeNull();
  });

  it("merges a className", async () => {
    const screen = await render(<ProjectArt size="card" className="ring-selected" />);
    expect(screen.container.firstElementChild?.classList.contains("ring-selected")).toBe(true);
  });
});
