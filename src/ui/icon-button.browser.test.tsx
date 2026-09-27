import { render } from "@/test/render";
import { IconButton } from "@/ui/icon-button";
import { IconX } from "@tabler/icons-react";
import { describe, expect, it } from "vitest";

// -- Tests --------------------------------------------------------------------

describe("IconButton", () => {
  it("names the button with its label and shows the same text as a tooltip", async () => {
    const screen = await render(<IconButton label="Close" icon={<IconX />} />);
    const button = screen.getByRole("button", { name: "Close" });
    await expect.element(button).toBeInTheDocument();
    await expect.element(button).toHaveAttribute("title", "Close");
  });

  it("renders the icon size recipe of the button primitive", async () => {
    const screen = await render(<IconButton label="Close" icon={<IconX />} variant="ghost" className="size-6" />);
    const button = screen.getByRole("button", { name: "Close" });
    await expect.element(button).toHaveClass("p-0");
    await expect.element(button).toHaveClass("size-6");
    await expect.element(button).not.toHaveClass("size-8");
    await expect.element(button).toHaveClass("text-composer-text-muted");
  });

  it("renders the icon as its only content", async () => {
    const screen = await render(<IconButton label="Close" icon={<svg data-testid="glyph" />} />);
    const button = screen.getByRole("button", { name: "Close" }).element();
    expect(button.children).toHaveLength(1);
    expect(button.querySelector("[data-testid='glyph']")).not.toBe(null);
  });

  it("fires onClick and respects disabled", async () => {
    let clicks = 0;
    const screen = await render(
      <>
        <IconButton label="Enabled" icon={<IconX />} onClick={() => clicks++} />
        <IconButton label="Disabled" icon={<IconX />} disabled onClick={() => clicks++} />
      </>,
    );
    await screen.getByRole("button", { name: "Enabled" }).click();
    await expect.element(screen.getByRole("button", { name: "Disabled" })).toBeDisabled();
    expect(clicks).toBe(1);
  });
});
