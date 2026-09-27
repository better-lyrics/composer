import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { render } from "@/test/render";
import { NoMatches } from "@/ui/no-matches";

describe("NoMatches", () => {
  it("shows the message as a status with the zoom-question icon", async () => {
    const screen = await render(<NoMatches message={'No settings match "snpa"'} />);
    await expect.element(screen.getByRole("status")).toHaveTextContent('No settings match "snpa"');
    expect(screen.container.querySelector("svg.tabler-icon-zoom-question")).not.toBeNull();
  });

  it("shows the hint when given", async () => {
    const screen = await render(<NoMatches message="No matches" hint="Check the spelling." />);
    await expect.element(screen.getByText("Check the spelling.")).toBeInTheDocument();
  });

  it("renders the action and it responds to the keyboard", async () => {
    let clicked = 0;
    const screen = await render(
      <NoMatches
        message="No matches"
        action={
          <button type="button" onClick={() => clicked++}>
            Clear search
          </button>
        }
      />,
    );
    (screen.getByRole("button", { name: "Clear search" }).element() as HTMLElement).focus();
    await userEvent.keyboard("{Enter}");
    expect(clicked).toBe(1);
  });

  it("renders a slightly larger icon and message at the large size", async () => {
    const screen = await render(<NoMatches message="No matches" size="large" />);
    expect(screen.container.querySelector("svg.tabler-icon-zoom-question")?.getAttribute("width")).toBe("28");
    await expect.element(screen.getByText("No matches")).toHaveClass("text-sm");
  });

  describe("edge cases", () => {
    it("keeps the compact size by default", async () => {
      const screen = await render(<NoMatches message="No matches" />);
      expect(screen.container.querySelector("svg.tabler-icon-zoom-question")?.getAttribute("width")).toBe("22");
      await expect.element(screen.getByText("No matches")).toHaveClass("text-xs");
    });

    it("renders no hint or action slot when omitted", async () => {
      const screen = await render(<NoMatches message="No matches" />);
      expect(screen.container.querySelectorAll("button").length).toBe(0);
    });
  });
});
