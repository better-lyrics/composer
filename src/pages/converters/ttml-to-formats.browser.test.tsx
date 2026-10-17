import { SAMPLE_TTML } from "@/pages/converters/sample-ttml";
import TtmlToLrcPage, { TtmlToLrcContent } from "@/pages/converters/ttml-to-lrc";
import TtmlToQrcPage, { TtmlToQrcContent } from "@/pages/converters/ttml-to-qrc";
import TtmlToSrtPage, { TtmlToSrtContent } from "@/pages/converters/ttml-to-srt";
import { render } from "@/test/render";
import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";

// -- Helpers ------------------------------------------------------------------

function outputPane(container: HTMLElement): HTMLElement | null {
  return container.querySelector<HTMLElement>("pre:not([aria-hidden])");
}

function outputText(container: HTMLElement): string {
  return outputPane(container)?.textContent ?? "";
}

async function renderConverter(Content: React.FC) {
  const screen = await render(<Content />, { withRouter: true });
  const textarea = screen.container.querySelector("textarea") as HTMLTextAreaElement;
  return { screen, textarea };
}

const PAGES = [
  { label: "LRC", Page: TtmlToLrcPage, Content: TtmlToLrcContent },
  { label: "SRT", Page: TtmlToSrtPage, Content: TtmlToSrtContent },
  { label: "QRC", Page: TtmlToQrcPage, Content: TtmlToQrcContent },
];

// -- Tests --------------------------------------------------------------------

describe.each(PAGES)("TTML to $label page", ({ label, Page, Content }) => {
  it("exports a default page component", () => {
    expect(typeof Page).toBe("function");
  });

  it("renders the converter heading and output label", async () => {
    const { screen } = await renderConverter(Content);

    await expect.element(screen.getByRole("heading", { name: `TTML to ${label} Converter` })).toBeInTheDocument();
    await expect.element(screen.getByText(`${label} output`, { exact: true })).toBeInTheDocument();
  });

  it("converts the sample and offers a download with the target extension", async () => {
    const { screen } = await renderConverter(Content);

    await userEvent.click(screen.getByRole("button", { name: "Load sample" }));

    expect(outputText(screen.container)).toContain("First");
    await expect.element(screen.getByRole("button", { name: "Download" })).toBeEnabled();
    await expect.element(screen.getByLabelText("Filename")).toHaveValue(`lyrics.${label.toLowerCase()}`);
  });

  it(`highlights the output as ${label}`, async () => {
    const { screen, textarea } = await renderConverter(Content);

    await userEvent.fill(textarea, SAMPLE_TTML);

    expect(outputPane(screen.container)?.classList.contains("bh")).toBe(true);
    expect(outputPane(screen.container)?.querySelector(".bh-timestamp")).not.toBeNull();
  });

  it("surfaces an error for input that is not TTML", async () => {
    const { screen, textarea } = await renderConverter(Content);

    await userEvent.fill(textarea, "these words carry no timing at all");

    expect(outputText(screen.container)).toMatch(/No timed lines found|Could not parse TTML/);
  });

  it("opens the converted lyrics in Composer", async () => {
    const { screen, textarea } = await renderConverter(Content);

    await userEvent.fill(textarea, SAMPLE_TTML);

    await expect
      .element(screen.getByRole("link", { name: "Open in Composer" }))
      .toHaveAttribute("href", expect.stringMatching(/^\/editor#import=/));
  });
});

describe("TTML to LRC output", () => {
  it("writes the sample as Enhanced LRC with the title tag", async () => {
    const { screen, textarea } = await renderConverter(TtmlToLrcContent);

    await userEvent.fill(textarea, SAMPLE_TTML);

    const output = outputText(screen.container);
    expect(output).toContain("[ti:Sample Song]");
    expect(output).toContain("[00:00.50]<00:00.50>First <00:01.00>line");
    expect(output).toContain("(oh)");
  });
});

describe("TTML to SRT output", () => {
  it("writes the sample as numbered cues", async () => {
    const { screen, textarea } = await renderConverter(TtmlToSrtContent);

    await userEvent.fill(textarea, SAMPLE_TTML);

    expect(outputText(screen.container)).toContain("1\n00:00:00,500 --> 00:00:03,000\nFirst line with timing");
  });
});

describe("TTML to QRC output", () => {
  it("writes singer markers for the two voices in the sample", async () => {
    const { screen, textarea } = await renderConverter(TtmlToQrcContent);

    await userEvent.fill(textarea, SAMPLE_TTML);

    const output = outputText(screen.container);
    expect(output).toContain("Lead：");
    expect(output).toContain("Duet：");
    expect(output).toContain("[500,2500]First (500,500)");
  });
});
