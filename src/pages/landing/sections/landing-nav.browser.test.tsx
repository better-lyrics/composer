import { describe, expect, it } from "vitest";
import { LandingNav } from "@/pages/landing/sections/landing-nav";
import { render } from "@/test/render";

describe("LandingNav", () => {
  it("renders nav element with at least one link", async () => {
    const screen = await render(<LandingNav />, { withRouter: true });
    expect(screen.container.querySelector("nav, header")).not.toBeNull();
    expect(screen.container.querySelectorAll("a").length).toBeGreaterThan(0);
  });

  it("links every converter page", async () => {
    const screen = await render(<LandingNav />, { withRouter: true });
    for (const path of ["/lrc-to-ttml", "/srt-to-ttml", "/qrc-to-ttml"]) {
      expect(screen.container.querySelector(`a[href="${path}"]`), `missing nav link for ${path}`).not.toBeNull();
    }
  });
});
