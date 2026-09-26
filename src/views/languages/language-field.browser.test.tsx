import { render } from "@/test/render";
import { LanguageField } from "@/views/languages/language-field";
import { describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";

// -- Tests --------------------------------------------------------------------

describe("LanguageField", () => {
  it("renders a labelled input carrying the current value", async () => {
    const screen = await render(<LanguageField label="Transliteration" value="hajimemashite" onChange={vi.fn()} />);
    await expect.element(screen.getByRole("textbox", { name: "Transliteration" })).toHaveValue("hajimemashite");
  });

  it("renders the action slot beside the input", async () => {
    const screen = await render(
      <LanguageField
        label="Transliteration"
        value=""
        action={<button type="button">Align</button>}
        onChange={vi.fn()}
      />,
    );
    await expect.element(screen.getByRole("button", { name: "Align" })).toBeInTheDocument();
  });

  it("types into the input and reports each keystroke to onChange", async () => {
    const calls: string[] = [];
    const screen = await render(
      <LanguageField label="Transliteration" value="" onChange={(value) => calls.push(value)} />,
    );
    const input = screen.getByRole("textbox", { name: "Transliteration" }).element() as HTMLInputElement;
    input.focus();
    await userEvent.type(input, "so");
    expect(calls.join("")).toBe("so");
  });

  describe("status tones", () => {
    it("applies the review tone border and icon when status is review", async () => {
      const screen = await render(<LanguageField label="English" value="Sky" status="review" onChange={vi.fn()} />);
      await expect.element(screen.getByRole("textbox", { name: "English" })).toHaveClass("border-composer-warning/40");
      const icon = screen.container.querySelector("label svg");
      expect(icon).not.toBeNull();
    });

    it("marks the input invalid and wires the error to aria-describedby", async () => {
      const screen = await render(<LanguageField label="English" value="" error="Required" onChange={vi.fn()} />);
      const input = screen.getByRole("textbox", { name: "English" });
      await expect.element(input).toHaveAttribute("aria-invalid", "true");
      const alert = screen.getByRole("alert");
      await expect.element(alert).toHaveTextContent("Required");
      const describedBy = input.element().getAttribute("aria-describedby");
      expect(describedBy).toBe(alert.element().id);
    });
  });

  describe("edge cases", () => {
    it("renders an empty value without an error or status tone", async () => {
      const screen = await render(<LanguageField label="Transliteration" value="" onChange={vi.fn()} />);
      await expect.element(screen.getByRole("textbox", { name: "Transliteration" })).toHaveValue("");
      expect(screen.container.querySelector('[role="alert"]')).toBeNull();
    });

    it("uses the ariaLabel over the visible label for the accessible name", async () => {
      const screen = await render(
        <LanguageField label="Transliteration" ariaLabel="Background transliteration" value="" onChange={vi.fn()} />,
      );
      await expect
        .element(screen.getByRole("textbox", { name: "Background transliteration", exact: true }))
        .toBeInTheDocument();
      await expect.element(screen.getByText("Transliteration", { exact: true })).toBeInTheDocument();
    });

    it("renders no action element when none is given", async () => {
      const screen = await render(<LanguageField label="English" value="" onChange={vi.fn()} />);
      expect(screen.container.querySelector("button")).toBeNull();
    });

    it("applies a monospace font only when mono is set", async () => {
      const screen = await render(<LanguageField label="Transliteration" value="so" mono onChange={vi.fn()} />);
      await expect.element(screen.getByRole("textbox", { name: "Transliteration" })).toHaveClass("font-mono");
    });
  });

  describe("invariants", () => {
    it("always shows the error tone over review when both apply", async () => {
      const screen = await render(
        <LanguageField label="English" value="Sky" status="review" error="Mismatch" onChange={vi.fn()} />,
      );
      const input = screen.getByRole("textbox", { name: "English" });
      await expect.element(input).toHaveClass("border-composer-error");
      await expect.element(input).not.toHaveClass("border-composer-warning/40");
      await expect.element(screen.getByRole("alert")).toHaveTextContent("Mismatch");
    });
  });
});
