import { render } from "@/test/render";
import { ModelTermsInfo } from "@/ui/model-terms-info";
import { describe, expect, it } from "vitest";

const TERMS = { notice: "Derived from Base. Subject to License 1.0.", url: "https://models.test/LICENSE.txt" };

describe("ModelTermsInfo", () => {
  it("shows the model's license notice and links to the full license", async () => {
    const screen = await render(<ModelTermsInfo terms={TERMS} />);
    await screen.getByRole("button", { name: "Model license" }).click();
    await expect.element(screen.getByText(TERMS.notice)).toBeVisible();
    await expect.element(screen.getByRole("link", { name: "View license" })).toHaveAttribute("href", TERMS.url);
  });
});
