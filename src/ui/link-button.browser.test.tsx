import { HIT_TESTING_UTILITIES_CSS, installStyleSheet } from "@/test/browser-css";
import { render } from "@/test/render";
import { buttonClassName } from "@/ui/button-class-name";
import { LinkButton } from "@/ui/link-button";
import { describe, expect, it } from "vitest";

// -- Tests --------------------------------------------------------------------

describe("LinkButton", () => {
  it("renders one router link styled like a button, with no button inside", async () => {
    const screen = await render(
      <LinkButton to="/app" variant="primary" hasIcon>
        Open
      </LinkButton>,
      { withRouter: true },
    );
    const link = screen.getByRole("link", { name: "Open" });
    await expect.element(link).toHaveAttribute("href", "/app");
    expect(link.element().className).toBe(buttonClassName({ variant: "primary", hasIcon: true }));
    expect(screen.container.querySelectorAll("a")).toHaveLength(1);
    expect(screen.container.querySelector("button")).toBe(null);
  });

  it("renders a plain anchor for an href, keeping the fragment", async () => {
    const screen = await render(<LinkButton href="/#open=abc">Open in Composer</LinkButton>);
    const link = screen.getByRole("link", { name: "Open in Composer" });
    await expect.element(link).toHaveAttribute("href", "/#open=abc");
    expect(link.element().className).toBe(buttonClassName({}));
  });

  it("merges a caller class over the shared recipe", async () => {
    const screen = await render(
      <LinkButton href="/x" size="sm" className="h-9">
        Go
      </LinkButton>,
    );
    const className = screen.getByRole("link", { name: "Go" }).element().className;
    expect(className).toContain("h-9");
    expect(className).not.toContain("h-7");
  });

  it("renders disabled as a non-focusable element with no href", async () => {
    const screen = await render(
      <>
        <LinkButton href="/#open=abc" disabled>
          Open in Composer
        </LinkButton>
        <button type="button">After</button>
      </>,
    );
    const link = screen.getByRole("link", { name: "Open in Composer" });
    await expect.element(link).toHaveAttribute("aria-disabled", "true");
    await expect.element(link).not.toHaveAttribute("href");
    const target = link.element();
    if (target instanceof HTMLElement) target.focus();
    expect(document.activeElement).not.toBe(target);
  });

  it("dims a disabled link the way a disabled Button is dimmed", async () => {
    const screen = await render(
      <LinkButton href="/x" disabled>
        Go
      </LinkButton>,
    );
    const className = screen.getByRole("link", { name: "Go" }).element().className;
    expect(className).toContain("opacity-50");
    expect(className).toContain("cursor-not-allowed");
  });

  it("takes no pointer input while disabled, so hover never brightens it", async () => {
    const utilities = installStyleSheet(HIT_TESTING_UTILITIES_CSS);
    try {
      const screen = await render(
        <LinkButton href="/x" variant="primary" disabled>
          Go
        </LinkButton>,
      );
      expect(getComputedStyle(screen.getByRole("link", { name: "Go" }).element()).pointerEvents).toBe("none");
    } finally {
      utilities.remove();
    }
  });
});
