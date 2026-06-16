import { describe, expect, it, vi } from "vitest";
import { ThemeTokenInput } from "@/ui/settings/theme/theme-token-input";
import { render } from "@/test/render";

// -- Tests --------------------------------------------------------------------

describe("ThemeTokenInput", () => {
  it("renders the label, a color swatch input, and a hex text field showing the value", async () => {
    const screen = await render(
      <ThemeTokenInput tokenKey="accent" label="Accent" value="#818cf8" onChange={() => {}} />,
    );
    await expect.element(screen.getByText("Accent")).toBeInTheDocument();
    const color = screen.getByLabelText("Accent color").element() as HTMLInputElement;
    const hex = screen.getByLabelText("Accent hex").element() as HTMLInputElement;
    expect(color.value).toBe("#818cf8");
    expect(hex.value).toBe("#818cf8");
  });

  it("calls onChange with the new value when the color input fires input", async () => {
    const onChange = vi.fn();
    const screen = await render(
      <ThemeTokenInput tokenKey="accent" label="Accent" value="#818cf8" onChange={onChange} />,
    );
    const color = screen.getByLabelText("Accent color").element() as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setter?.call(color, "#ff0000");
    color.dispatchEvent(new Event("input", { bubbles: true }));
    expect(onChange).toHaveBeenCalledWith("#ff0000");
  });

  it("commits a valid 6-digit hex on blur", async () => {
    const onChange = vi.fn();
    const screen = await render(
      <ThemeTokenInput tokenKey="accent" label="Accent" value="#818cf8" onChange={onChange} />,
    );
    const hex = screen.getByLabelText("Accent hex");
    const el = hex.element() as HTMLInputElement;
    el.focus();
    await hex.fill("#00ff00");
    el.blur();
    expect(onChange).toHaveBeenCalledWith("#00ff00");
  });

  it("accepts a 3-digit shorthand hex on blur", async () => {
    const onChange = vi.fn();
    const screen = await render(
      <ThemeTokenInput tokenKey="accent" label="Accent" value="#818cf8" onChange={onChange} />,
    );
    const hex = screen.getByLabelText("Accent hex");
    const el = hex.element() as HTMLInputElement;
    el.focus();
    await hex.fill("#0f0");
    el.blur();
    expect(onChange).toHaveBeenCalledWith("#0f0");
  });

  it("does NOT call onChange for an invalid hex (missing #)", async () => {
    const onChange = vi.fn();
    const screen = await render(
      <ThemeTokenInput tokenKey="accent" label="Accent" value="#818cf8" onChange={onChange} />,
    );
    const hex = screen.getByLabelText("Accent hex");
    const el = hex.element() as HTMLInputElement;
    el.focus();
    await hex.fill("ff0000");
    el.blur();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("does NOT call onChange for an invalid hex (wrong length)", async () => {
    const onChange = vi.fn();
    const screen = await render(
      <ThemeTokenInput tokenKey="accent" label="Accent" value="#818cf8" onChange={onChange} />,
    );
    const hex = screen.getByLabelText("Accent hex");
    const el = hex.element() as HTMLInputElement;
    el.focus();
    await hex.fill("#12345");
    el.blur();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("commits a valid hex on Enter", async () => {
    const onChange = vi.fn();
    const screen = await render(
      <ThemeTokenInput tokenKey="accent" label="Accent" value="#818cf8" onChange={onChange} />,
    );
    const hex = screen.getByLabelText("Accent hex");
    await hex.fill("#abcdef");
    await screen
      .getByLabelText("Accent hex")
      .element()
      .dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(onChange).toHaveBeenCalledWith("#abcdef");
  });

  it("syncs the hex text field when the value prop changes externally (no remount)", async () => {
    const screen = await render(
      <ThemeTokenInput tokenKey="accent" label="Accent" value="#111111" onChange={() => {}} />,
    );
    const hex = screen.getByLabelText("Accent hex").element() as HTMLInputElement;
    expect(hex.value).toBe("#111111");

    await screen.rerender(<ThemeTokenInput tokenKey="accent" label="Accent" value="#222222" onChange={() => {}} />);
    expect((screen.getByLabelText("Accent hex").element() as HTMLInputElement).value).toBe("#222222");
  });

  it("preserves in-progress typing while the value prop is unchanged", async () => {
    const onChange = vi.fn();
    const screen = await render(
      <ThemeTokenInput tokenKey="accent" label="Accent" value="#111111" onChange={onChange} />,
    );
    const hex = screen.getByLabelText("Accent hex");
    await hex.fill("#1234");
    await screen.rerender(<ThemeTokenInput tokenKey="accent" label="Accent" value="#111111" onChange={onChange} />);
    expect((hex.element() as HTMLInputElement).value).toBe("#1234");
  });
});
