import { describe, expect, it } from "vitest";
import { LandingFooter } from "@/pages/landing/sections/landing-footer";
import { render } from "@/test/render";

describe("LandingFooter", () => {
  it("renders a footer with at least one link", async () => {
    const screen = await render(<LandingFooter />, { withRouter: true });
    expect(screen.container.querySelector("footer")).not.toBeNull();
    expect(screen.container.querySelectorAll("a").length).toBeGreaterThan(0);
  });

  it("links every converter page", async () => {
    const screen = await render(<LandingFooter />, { withRouter: true });
    for (const path of ["/lrc-to-ttml", "/srt-to-ttml", "/qrc-to-ttml"]) {
      expect(screen.container.querySelector(`a[href="${path}"]`), `missing footer link for ${path}`).not.toBeNull();
    }
  });
});
