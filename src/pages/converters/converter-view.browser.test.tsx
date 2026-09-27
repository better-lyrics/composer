import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { convertViaParser } from "@/pages/converters/convert-via-parser";
import { ConverterView, type ConvertArgs } from "@/pages/converters/converter-view";
import { HIT_TESTING_UTILITIES_CSS, installStyleSheet } from "@/test/browser-css";
import { render } from "@/test/render";

const LRC_CONVERSION = {
  extension: "lrc",
  granularity: "auto" as const,
  emptyMessage: "No timed lines found.",
  failureMessage: "Could not parse LRC.",
  logLabel: "LRC",
};
const convertLrc = (args: ConvertArgs) => convertViaParser(LRC_CONVERSION, args);

function captureDownloads(): { names: string[]; restore: () => void } {
  const names: string[] = [];
  const originalClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
    if (this.download) names.push(this.download);
  };
  return {
    names,
    restore: () => {
      HTMLAnchorElement.prototype.click = originalClick;
    },
  };
}

function renderLrcConverter() {
  return render(
    <ConverterView
      title="LRC"
      inputLabel="LRC"
      inputPlaceholder="Paste LRC"
      sampleInput={"[00:01.00]valid\n[00:03.00]second"}
      convert={convertLrc}
      downloadFilename="lyrics.ttml"
    />,
    { withRouter: true },
  );
}

async function downloadWithFilename(typed: string): Promise<string[]> {
  const screen = await renderLrcConverter();
  await screen.getByRole("button", { name: "Load sample" }).click();
  await screen.getByRole("textbox", { name: "Filename" }).fill(typed);
  const originalCreate = URL.createObjectURL;
  URL.createObjectURL = () => "blob:test";
  const downloads = captureDownloads();
  try {
    await screen.getByRole("button", { name: /Download/ }).click();
  } finally {
    downloads.restore();
    URL.createObjectURL = originalCreate;
  }
  return downloads.names;
}

const FAKE_TTML = `<?xml version="1.0"?><tt><body><div><p>line</p></div></body></tt>`;

describe("ConverterView", () => {
  it("renders the title and input textarea", async () => {
    const screen = await render(
      <ConverterView
        title="LRC → TTML"
        inputLabel="LRC"
        inputPlaceholder="Paste LRC"
        sampleInput="[00:01.00] hello"
        convert={() => ({ ttml: FAKE_TTML, projectPayload: "{}", skippedLines: 0 })}
        downloadFilename="out.ttml"
      />,
      { withRouter: true },
    );
    await expect.element(screen.getByText("LRC → TTML")).toBeInTheDocument();
    expect(screen.container.querySelector("textarea")).not.toBeNull();
  });

  it("labels the input textarea", async () => {
    const screen = await render(
      <ConverterView
        title="LRC → TTML"
        inputLabel="LRC"
        inputPlaceholder="Paste LRC"
        sampleInput="[00:01.00] hello"
        convert={() => ({ ttml: FAKE_TTML, projectPayload: "{}", skippedLines: 0 })}
        downloadFilename="out.ttml"
      />,
      { withRouter: true },
    );
    await expect.element(screen.getByRole("textbox", { name: "Converter input" })).toBeInTheDocument();
  });

  it("produces TTML output when the user provides input", async () => {
    const screen = await render(
      <ConverterView
        title="LRC → TTML"
        inputLabel="LRC"
        inputPlaceholder="Paste LRC"
        sampleInput="[00:01.00] hello"
        convert={() => ({ ttml: FAKE_TTML, projectPayload: "{}", skippedLines: 0 })}
        downloadFilename="out.ttml"
      />,
      { withRouter: true },
    );
    const textarea = screen.container.querySelector("textarea") as HTMLTextAreaElement;
    await userEvent.fill(textarea, "[00:01.00] hello");
    expect(screen.container.textContent).toContain("tt");
  });

  it("links Open in Composer as one anchor once there is a project to open", async () => {
    const screen = await renderLrcConverter();
    await screen.getByRole("button", { name: "Load sample" }).click();
    const link = screen.getByRole("link", { name: "Open in Composer" });
    await expect.element(link).toHaveAttribute("href", expect.stringMatching(/^\/#/));
    expect(link.element().querySelector("button")).toBe(null);
  });

  it("lets the user select and read a long conversion error", async () => {
    const screen = await render(
      <ConverterView
        title="LRC"
        inputLabel="LRC"
        inputPlaceholder="Paste LRC"
        sampleInput="[00:01.00] hello"
        convert={() => ({ error: "Could not parse line 3: an unexpectedly long explanation that must wrap" })}
        downloadFilename="out.ttml"
      />,
      { withRouter: true },
    );
    await screen.getByRole("button", { name: "Load sample" }).click();
    const output = screen.getByText(/Could not parse line 3/);
    await expect.element(output).toHaveClass("select-text");
    await expect.element(output).toHaveClass("whitespace-pre-wrap");
    await expect.element(output).toHaveClass("break-words");
  });

  it("makes Open in Composer truly disabled with no project to open", async () => {
    const screen = await renderLrcConverter();
    const link = screen.getByRole("link", { name: "Open in Composer" });
    await expect.element(link).toHaveAttribute("aria-disabled", "true");
    await expect.element(link).not.toHaveAttribute("href");
    expect(link.element().querySelector("button")).toBe(null);
  });

  it("keeps the disabled Open in Composer at the quarter dimming the wrapped button had", async () => {
    const utilities = installStyleSheet(`${HIT_TESTING_UTILITIES_CSS}.opacity-25{opacity:.25}.opacity-50{opacity:.5}`);
    try {
      const screen = await renderLrcConverter();
      const style = getComputedStyle(screen.getByRole("link", { name: "Open in Composer" }).element());
      expect(style.pointerEvents).toBe("none");
      expect(style.opacity).toBe("0.25");
    } finally {
      utilities.remove();
    }
  });
});

describe("converter notice for lines it could not read", () => {
  async function convertLrcInput(input: string) {
    const screen = await renderLrcConverter();
    await screen.getByRole("textbox", { name: "Converter input" }).fill(input);
    return screen;
  }

  it("announces one unreadable line and still shows the TTML for the good lines", async () => {
    const screen = await convertLrcInput("[00:01.00]Good\n[00:99.99]Bad\n[00:03.00]Also good\n[00:05.00]");

    await expect.element(screen.getByRole("status")).toHaveTextContent("1 line could not be read.");
    await expect.poll(() => screen.container.querySelector("pre")?.textContent).toContain("Also good</p>");
    expect(screen.container.querySelector("pre")?.textContent).toContain("<tt");
  });

  it("pluralizes the count when several lines could not be read", async () => {
    const screen = await convertLrcInput(
      "[00:01.00]Good\n[00:99.99]Bad\n[00:98.00]Worse\n[00:05.00]Also good\n[00:07.00]",
    );

    await expect.element(screen.getByRole("status")).toHaveTextContent("2 lines could not be read.");
  });

  it("shows no notice for valid input", async () => {
    const screen = await convertLrcInput("[00:01.00]Good\n[00:03.00]Also good\n[00:05.00]");

    await expect.poll(() => screen.container.querySelector("pre")?.textContent).toContain("Also good</p>");
    await expect.element(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("keeps the error box and shows no notice when no line could be read", async () => {
    const screen = await convertLrcInput("[00:99.99]Bad");

    await expect.element(screen.getByText("No timed lines found.")).toBeInTheDocument();
    await expect.element(screen.getByRole("status")).toBeEmptyDOMElement();
  });
});

describe("sibling: converter Filename field is ignored by Download", () => {
  it("downloads with the name typed into the Filename field", async () => {
    const names = await downloadWithFilename("my-song.lrc");
    expect(names[0]).toMatch(/^my-song/);
  });

  it("adds the ttml extension when the typed name lacks it", async () => {
    expect(await downloadWithFilename("my-song")).toEqual(["my-song.ttml"]);
  });

  it("keeps a typed ttml extension as is", async () => {
    expect(await downloadWithFilename("my-song.ttml")).toEqual(["my-song.ttml"]);
  });

  it("strips reserved characters from the typed name", async () => {
    expect(await downloadWithFilename("a/b:c")).toEqual(["abc.ttml"]);
  });
});

describe("I7 converter output after the input is cleared", () => {
  it("disables Copy and Download once the input is cleared by the user", async () => {
    const screen = await renderLrcConverter();
    await screen.getByRole("button", { name: "Load sample" }).click();
    const copy = screen.getByRole("button", { name: /Copy/ });
    await expect.poll(() => (copy.element() as HTMLButtonElement).disabled).toBe(false);

    const input = screen.getByRole("textbox", { name: "Converter input" });
    await userEvent.click(input);
    await userEvent.keyboard("{ControlOrMeta>}a{/ControlOrMeta}{Backspace}");
    await expect.poll(() => (input.element() as HTMLTextAreaElement).value).toBe("");
    await expect.poll(() => (copy.element() as HTMLButtonElement).disabled).toBe(true);
  });
});
