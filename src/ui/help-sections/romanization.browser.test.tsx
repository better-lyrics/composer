import { describe, expect, it } from "vitest";
import { render } from "@/test/render";
import { RomanizationSection } from "@/ui/help-sections/romanization";
import { ALT_KEY } from "@/utils/platform";

describe("RomanizationSection", () => {
  it("renders the section title", async () => {
    const screen = await render(<RomanizationSection />);
    await expect.element(screen.getByRole("heading", { name: "What gets romanized" })).toBeInTheDocument();
  });

  it("lists japanese with hepburn in the coverage matrix", async () => {
    const screen = await render(<RomanizationSection />);
    await expect.poll(() => screen.container.textContent ?? "").toContain("Japanese");
    await expect.poll(() => screen.container.textContent ?? "").toContain("ja-Latn-hepburn");
  });

  it("lists korean with rr in the coverage matrix", async () => {
    const screen = await render(<RomanizationSection />);
    await expect.poll(() => screen.container.textContent ?? "").toContain("Korean");
    await expect.poll(() => screen.container.textContent ?? "").toContain("ko-Latn-rr");
  });

  it("mentions the alt key in the per-word edit prose", async () => {
    const screen = await render(<RomanizationSection />);
    await expect.poll(() => screen.container.textContent ?? "").toContain(`${ALT_KEY}+click`);
  });

  it("mentions the settings location for self-host", async () => {
    const screen = await render(<RomanizationSection />);
    await expect
      .poll(() => screen.container.textContent ?? "")
      .toContain("Settings");
  });
});
