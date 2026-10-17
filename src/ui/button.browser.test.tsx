import { render } from "@/test/render";
import { Button } from "@/ui/button";
import { buttonClassName } from "@/ui/button-class-name";
import { describe, expect, it } from "vitest";

// -- Render -------------------------------------------------------------------

describe("Button", () => {
  it("renders children inside a button element", async () => {
    const screen = await render(<Button>Click me</Button>);
    await expect.element(screen.getByRole("button", { name: "Click me" })).toBeInTheDocument();
  });

  it("fires onClick when activated by the mouse", async () => {
    let clicks = 0;
    const screen = await render(<Button onClick={() => clicks++}>Press</Button>);
    await screen.getByRole("button", { name: "Press" }).click();
    expect(clicks).toBe(1);
  });

  it("fires onClick when activated by the keyboard", async () => {
    let clicks = 0;
    const screen = await render(<Button onClick={() => clicks++}>Press</Button>);
    const button = screen.getByRole("button", { name: "Press" });
    (button.element() as HTMLButtonElement).focus();
    await button.element().dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    (button.element() as HTMLButtonElement).click();
    expect(clicks).toBeGreaterThanOrEqual(1);
  });

  // -- Disabled state ---------------------------------------------------------

  it("does not fire onClick when disabled", async () => {
    let clicks = 0;
    const screen = await render(
      <Button disabled onClick={() => clicks++}>
        Press
      </Button>,
    );
    const el = screen.getByRole("button", { name: "Press" }).element() as HTMLButtonElement;
    expect(el.disabled).toBe(true);
    el.click();
    expect(clicks).toBe(0);
  });

  it("forwards aria-label to the underlying button element", async () => {
    const screen = await render(
      <Button size="icon" aria-label="Open settings">
        S
      </Button>,
    );
    await expect.element(screen.getByRole("button", { name: "Open settings" })).toBeInTheDocument();
  });

  it("accepts all variant and size prop combinations without errors", async () => {
    const screen = await render(
      <>
        <Button variant="primary" size="sm">
          A
        </Button>
        <Button variant="secondary" size="md">
          B
        </Button>
        <Button variant="ghost" size="md" hasIcon>
          C
        </Button>
      </>,
    );
    await expect.element(screen.getByRole("button", { name: "A" })).toBeInTheDocument();
    await expect.element(screen.getByRole("button", { name: "B" })).toBeInTheDocument();
    await expect.element(screen.getByRole("button", { name: "C" })).toBeInTheDocument();
  });
});

describe("Button danger variants", () => {
  it("renders the ghost danger and the solid destructive variants as buttons", async () => {
    const screen = await render(
      <>
        <Button variant="danger">Delete</Button>
        <Button variant="destructive">Replace project</Button>
      </>,
    );
    await expect.element(screen.getByRole("button", { name: "Delete" })).toHaveClass("text-composer-negative");
    await expect.element(screen.getByRole("button", { name: "Replace project" })).toHaveClass("bg-composer-error");
  });

  describe("regressions", () => {
    it("regression: destructive hover is derived from the composer-error token, not a hardcoded hex", async () => {
      const screen = await render(<Button variant="destructive">Replace project</Button>);
      const button = screen.getByRole("button", { name: "Replace project" });
      await expect.element(button).toHaveClass("hover:bg-[color-mix(in_srgb,var(--color-composer-error)_85%,white)]");
      await expect.element(button).not.toHaveClass("hover:bg-[#c46262]");
    });
  });
});

describe("Button quiet variant", () => {
  it("dims its icon with opacity instead of a translucent color", async () => {
    const screen = await render(
      <Button variant="quiet" hasIcon>
        <svg aria-hidden="true" />
        Export
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Export" });
    await expect.element(button).toHaveClass("[&_svg]:text-composer-text", "[&_svg]:opacity-60");
    await expect.element(button).not.toHaveClass("text-composer-text-muted");
  });
});

describe("buttonClassName", () => {
  it("gives a link the same classes as the matching button", async () => {
    const screen = await render(
      <Button variant="ghost" size="sm" hasIcon>
        Ghost
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Ghost" }).element();
    expect(button.className).toBe(buttonClassName({ variant: "ghost", size: "sm", hasIcon: true }));
  });

  describe("edge cases", () => {
    it("defaults to the secondary medium button", () => {
      expect(buttonClassName()).toBe(buttonClassName({ variant: "secondary", size: "md", hasIcon: false }));
      expect(buttonClassName()).toContain("h-8");
    });
  });
});
