import { describe, expect, it } from "vitest";
import { render } from "@/test/render";
import { RomanizationReference } from "@/views/sync/romanization-reference";

// -- Tests --------------------------------------------------------------------

describe("RomanizationReference", () => {
  it("renders the romanization text", async () => {
    const screen = await render(<RomanizationReference text="yoru dakedo" isCurrent={false} />);
    expect(screen.container.textContent).toContain("yoru dakedo");
  });

  it("uses italic readable style", async () => {
    const screen = await render(<RomanizationReference text="yoru" isCurrent={false} />);
    const node = screen.container.querySelector('[data-testid="romanization-reference"]') as HTMLElement;
    expect(node).not.toBeNull();
    expect(node.className).toMatch(/italic/);
  });

  it("applies accent text color when active", async () => {
    const screen = await render(<RomanizationReference text="yoru" isCurrent />);
    const node = screen.container.querySelector('[data-testid="romanization-reference"]') as HTMLElement;
    expect(node.className).toMatch(/text-composer-accent-text/);
  });

  it("applies muted text color when inactive", async () => {
    const screen = await render(<RomanizationReference text="yoru" isCurrent={false} />);
    const node = screen.container.querySelector('[data-testid="romanization-reference"]') as HTMLElement;
    expect(node.className).toMatch(/text-composer-text-muted/);
  });

  it("uses pointer-events-none so taps fall through to source words", async () => {
    const screen = await render(<RomanizationReference text="yoru" isCurrent />);
    const node = screen.container.querySelector('[data-testid="romanization-reference"]') as HTMLElement;
    expect(node.className).toMatch(/pointer-events-none/);
  });

  it("renders nothing when text is empty", async () => {
    const screen = await render(<RomanizationReference text="" isCurrent={false} />);
    expect(screen.container.querySelector('[data-testid="romanization-reference"]')).toBeNull();
  });

  it("renders nothing when text is whitespace only", async () => {
    const screen = await render(<RomanizationReference text="   " isCurrent={false} />);
    expect(screen.container.querySelector('[data-testid="romanization-reference"]')).toBeNull();
  });

  it("keeps text user-selectable for copy", async () => {
    const screen = await render(<RomanizationReference text="yoru" isCurrent={false} />);
    const node = screen.container.querySelector('[data-testid="romanization-reference"]') as HTMLElement;
    expect(node.className).toMatch(/select-text/);
  });
});
