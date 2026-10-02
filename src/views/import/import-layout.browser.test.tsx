import { render } from "@/test/render";
import { OrDivider } from "@/views/import/import-layout";
import { describe, expect, it } from "vitest";

describe("OrDivider", () => {
  it("separates the two ways to add audio", async () => {
    const screen = await render(<OrDivider />);
    await expect.element(screen.getByText("or")).toBeInTheDocument();
  });
});
