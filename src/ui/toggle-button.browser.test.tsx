import { render } from "@/test/render";
import { ToggleButton } from "@/ui/toggle-button";
import { describe, expect, it } from "vitest";

// -- Tests --------------------------------------------------------------------

describe("ToggleButton", () => {
  it("reports pressed and renders the primary variant at full opacity", async () => {
    const screen = await render(<ToggleButton pressed>Follow</ToggleButton>);
    const button = screen.getByRole("button", { name: "Follow", pressed: true });
    await expect.element(button).toHaveAttribute("aria-pressed", "true");
    await expect.element(button).toHaveClass("bg-composer-accent-dark");
    await expect.element(button).not.toHaveClass("opacity-60");
  });

  it("reports not pressed and renders the dimmed ghost variant", async () => {
    const screen = await render(<ToggleButton pressed={false}>Follow</ToggleButton>);
    const button = screen.getByRole("button", { name: "Follow", pressed: false });
    await expect.element(button).toHaveAttribute("aria-pressed", "false");
    await expect.element(button).toHaveClass("text-composer-text-muted");
    await expect.element(button).toHaveClass("opacity-60");
    await expect.element(button).not.toHaveClass("bg-composer-accent-dark");
  });

  it("lets a caller class override the dimming", async () => {
    const screen = await render(
      <ToggleButton pressed={false} className="opacity-50">
        Snap
      </ToggleButton>,
    );
    const button = screen.getByRole("button", { name: "Snap" });
    await expect.element(button).toHaveClass("opacity-50");
    await expect.element(button).not.toHaveClass("opacity-60");
  });

  it("passes size and hasIcon through to the button primitive", async () => {
    const screen = await render(
      <ToggleButton pressed size="sm" hasIcon>
        Snap
      </ToggleButton>,
    );
    await expect.element(screen.getByRole("button", { name: "Snap" })).toHaveClass("h-7 pl-2 pr-3 text-xs");
  });

  it("omits aria-pressed when the label itself names the state, keeping the same look", async () => {
    const screen = await render(
      <>
        <ToggleButton pressed stateInLabel>
          Transliteration
        </ToggleButton>
        <ToggleButton pressed>Follow</ToggleButton>
      </>,
    );
    const labelled = screen.getByRole("button", { name: "Transliteration" });
    await expect.element(labelled).not.toHaveAttribute("aria-pressed");
    expect(labelled.element().className).toBe(screen.getByRole("button", { name: "Follow" }).element().className);
  });

  it("fires onClick", async () => {
    let clicks = 0;
    const screen = await render(
      <ToggleButton pressed={false} onClick={() => clicks++}>
        Follow
      </ToggleButton>,
    );
    await screen.getByRole("button", { name: "Follow" }).click();
    expect(clicks).toBe(1);
  });
});
