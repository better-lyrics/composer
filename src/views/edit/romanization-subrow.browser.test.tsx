import { describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { render } from "@/test/render";
import { RomanizationSubrow } from "@/views/edit/romanization-subrow";

// -- Tests --------------------------------------------------------------------

describe("RomanizationSubrow filled state", () => {
  it("renders the romanization text", async () => {
    const screen = await render(<RomanizationSubrow text="yoru dakedo" />);
    expect(screen.container.textContent).toContain("yoru dakedo");
  });

  it("uses an italic small style for readability", async () => {
    const screen = await render(<RomanizationSubrow text="yoru" />);
    const node = screen.container.querySelector('[data-testid="romanization-subrow"]') as HTMLElement;
    expect(node).not.toBeNull();
    expect(node.className).toMatch(/italic/);
  });

  it("uses a muted text color", async () => {
    const screen = await render(<RomanizationSubrow text="yoru" />);
    const node = screen.container.querySelector('[data-testid="romanization-subrow"]') as HTMLElement;
    expect(node.className).toMatch(/text-composer-text-muted/);
  });

  it("renders nothing when text is empty", async () => {
    const screen = await render(<RomanizationSubrow text="" />);
    expect(screen.container.querySelector('[data-testid="romanization-subrow"]')).toBeNull();
  });
});

describe("RomanizationSubrow ghost state", () => {
  it("renders a ghost prompt when text is undefined and ghost mode is on", async () => {
    const screen = await render(<RomanizationSubrow ghost />);
    expect(screen.container.textContent).toContain("Add romanization");
  });

  it("invokes onAddClick when the ghost prompt is clicked", async () => {
    const onAddClick = vi.fn();
    const screen = await render(<RomanizationSubrow ghost onAddClick={onAddClick} />);
    const trigger = screen.getByRole("button", { name: /add romanization/i });
    await userEvent.click(trigger.element());
    expect(onAddClick).toHaveBeenCalledTimes(1);
  });

  it("renders nothing in ghost mode when filled text is also provided", async () => {
    const screen = await render(<RomanizationSubrow ghost text="already filled" />);
    expect(screen.container.textContent).toContain("already filled");
    expect(screen.container.textContent).not.toContain("Add romanization");
  });
});

describe("RomanizationSubrow invariants", () => {
  it("does not render anything when both ghost is false and text is empty", async () => {
    const screen = await render(<RomanizationSubrow text="" />);
    expect(screen.container.firstChild).toBeNull();
  });

  it("does not render anything when neither prop is supplied", async () => {
    const screen = await render(<RomanizationSubrow />);
    expect(screen.container.firstChild).toBeNull();
  });

  it("is content the user can copy when filled", async () => {
    const screen = await render(<RomanizationSubrow text="yoru" />);
    const node = screen.container.querySelector('[data-testid="romanization-subrow"]') as HTMLElement;
    expect(node.className).toMatch(/select-text/);
  });

  it("uses a button role for the ghost prompt for accessibility", async () => {
    const screen = await render(<RomanizationSubrow ghost />);
    const ghostTrigger = screen.getByRole("button", { name: /add romanization/i });
    await expect.element(ghostTrigger).toBeInTheDocument();
  });
});
