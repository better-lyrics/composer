import { describe, expect, it } from "vitest";
import { render } from "@/test/render";
import { TtmlStandardsSection } from "@/ui/help-sections/ttml-standards";

describe("TtmlStandardsSection", () => {
  it("renders the section content", async () => {
    const screen = await render(<TtmlStandardsSection />);
    await expect.element(screen.getByRole("heading", { name: "What Composer outputs" })).toBeInTheDocument();
  });

  it("frames the output as a TTML 1 subset, not strict W3C conformance", async () => {
    const screen = await render(<TtmlStandardsSection />);
    await expect.element(screen.getByText(/restricted subset of/i)).toBeInTheDocument();
  });
});
