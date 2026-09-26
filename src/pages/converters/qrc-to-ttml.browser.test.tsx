import QrcToTtmlPage, { QrcToTtmlContent } from "@/pages/converters/qrc-to-ttml";
import { WANDERLUST_QRC } from "@/test/qrc-fixtures";
import { render } from "@/test/render";
import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";

// -- Helpers ------------------------------------------------------------------

function outputText(container: HTMLElement): string {
  return container.querySelector("pre")?.textContent ?? "";
}

async function renderConverter() {
  const screen = await render(<QrcToTtmlContent />, { withRouter: true });
  const textarea = screen.container.querySelector("textarea") as HTMLTextAreaElement;
  return { screen, textarea };
}

// -- Tests --------------------------------------------------------------------

describe("QrcToTtmlPage", () => {
  it("exports a default page component", () => {
    expect(typeof QrcToTtmlPage).toBe("function");
  });

  it("renders the converter heading", async () => {
    const { screen } = await renderConverter();

    await expect.element(screen.getByRole("heading", { name: "QRC to TTML Converter" })).toBeInTheDocument();
  });

  it("converts a pasted QRC document into TTML", async () => {
    const { screen, textarea } = await renderConverter();

    await userEvent.fill(textarea, WANDERLUST_QRC);

    const output = outputText(screen.container);
    expect(output).toContain("<tt");
    expect(output).toContain("ttm:agent");
  });

  it("carries the singer markers through as two distinct agents", async () => {
    const { screen, textarea } = await renderConverter();

    await userEvent.fill(textarea, WANDERLUST_QRC);

    const output = outputText(screen.container);
    expect(output).toContain('<ttm:agent xml:id="v1"');
    expect(output).toContain('<ttm:agent xml:id="v2"');
    expect(output).toContain("The Weeknd");
    expect(output).toContain("Fox the Fox");
  });

  it("carries the QQ credits block through as songwriter metadata", async () => {
    const { screen, textarea } = await renderConverter();

    await userEvent.fill(textarea, WANDERLUST_QRC);

    expect(outputText(screen.container)).toContain('key="songwriter"');
  });

  it("populates the input from the sample control", async () => {
    const { screen, textarea } = await renderConverter();

    await userEvent.click(screen.getByRole("button", { name: "Load sample" }));

    expect(textarea.value).toContain("[ti:Sample Song]");
    expect(textarea.value).toContain("[34059,2299]");
    expect(outputText(screen.container)).toContain("<tt");
  });

  it("surfaces an error message for input that carries no QRC timing", async () => {
    const { screen, textarea } = await renderConverter();

    await userEvent.fill(textarea, "these words carry no timing at all");

    expect(outputText(screen.container)).toContain("No timed lines found");
  });

  it("offers a download named with a ttml extension once output exists", async () => {
    const { screen, textarea } = await renderConverter();

    await userEvent.fill(textarea, WANDERLUST_QRC);

    await expect.element(screen.getByRole("button", { name: "Download" })).toBeEnabled();
    await expect.element(screen.getByLabelText("Filename")).toHaveValue("lyrics.ttml");
  });

  it("explains where a QRC word tag sits relative to its word", async () => {
    const screen = await render(<QrcToTtmlContent />, { withRouter: true });

    await expect.element(screen.getByRole("heading", { name: "About QRC" })).toBeInTheDocument();
    expect(screen.container.textContent).toContain("comes after the word it times");
  });
});
