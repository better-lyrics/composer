import { GuideCode } from "@/pages/guides/guide-code";
import { render } from "@/test/render";
import { describe, expect, it } from "vitest";

// -- Tests --------------------------------------------------------------------

describe("GuideCode", () => {
  it("renders a highlighted, horizontally scrolling sample", async () => {
    const screen = await render(<GuideCode code={"[00:12.34]First line"} />);
    const pre = screen.container.querySelector("pre");
    expect(pre?.classList.contains("bh")).toBe(true);
    expect(pre?.classList.contains("overflow-x-auto")).toBe(true);
    expect(pre?.querySelector(".bh-timestamp")?.textContent).toBe("00:12.34");
  });

  it("highlights a TTML fragment when told it is TTML", async () => {
    const fragment = `<span ttm:role="x-bg">\n  <span begin="00:00:13.000" end="00:00:14.500">background phrase</span>\n</span>`;
    const screen = await render(<GuideCode code={fragment} format="ttml" />);
    const pre = screen.container.querySelector("pre");
    expect(pre?.textContent).toBe(fragment);
    expect([...(pre?.querySelectorAll(".bh-bgText") ?? [])].map((span) => span.textContent)).toContain(
      "background phrase",
    );
  });

  it("renders an empty sample without crashing", async () => {
    const screen = await render(<GuideCode code="" />);
    expect(screen.container.querySelector("pre")?.textContent).toBe("");
  });
});
