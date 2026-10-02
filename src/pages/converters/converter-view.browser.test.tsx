import { convertViaParser } from "@/pages/converters/convert-via-parser";
import { type ConvertArgs, ConverterView } from "@/pages/converters/converter-view";
import { TTML_OUTPUT } from "@/pages/converters/output-formats";
import {
  HIT_TESTING_UTILITIES_CSS,
  LYRICS_CODE_CSS,
  installStyleSheet,
  installUtilitiesUsedIn,
} from "@/test/browser-css";
import { render } from "@/test/render";
import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";

const LRC_CONVERSION = {
  extension: "lrc" as const,
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
      inputExtension="lrc"
      sampleInput={"[00:01.00]valid\n[00:03.00]second"}
      convert={convertLrc}
      outputFormat={TTML_OUTPUT}
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
        inputExtension="lrc"
        sampleInput="[00:01.00] hello"
        convert={() => ({ output: FAKE_TTML, projectPayload: "{}", skippedLines: 0 })}
        outputFormat={TTML_OUTPUT}
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
        inputExtension="lrc"
        sampleInput="[00:01.00] hello"
        convert={() => ({ output: FAKE_TTML, projectPayload: "{}", skippedLines: 0 })}
        outputFormat={TTML_OUTPUT}
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
        inputExtension="lrc"
        sampleInput="[00:01.00] hello"
        convert={() => ({ output: FAKE_TTML, projectPayload: "{}", skippedLines: 0 })}
        outputFormat={TTML_OUTPUT}
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
    await expect.element(link).toHaveAttribute("href", expect.stringMatching(/^\/editor#import=/));
    expect(link.element().querySelector("button")).toBe(null);
  });

  it("lets the user select and read a long conversion error", async () => {
    const screen = await render(
      <ConverterView
        title="LRC"
        inputLabel="LRC"
        inputPlaceholder="Paste LRC"
        inputExtension="lrc"
        sampleInput="[00:01.00] hello"
        convert={() => ({ error: "Could not parse line 3: an unexpectedly long explanation that must wrap" })}
        outputFormat={TTML_OUTPUT}
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
    await expect
      .poll(() => screen.container.querySelector("pre:not([aria-hidden])")?.textContent)
      .toContain("Also good</p>");
    expect(screen.container.querySelector("pre:not([aria-hidden])")?.textContent).toContain("<tt");
  });

  it("pluralizes the count when several lines could not be read", async () => {
    const screen = await convertLrcInput(
      "[00:01.00]Good\n[00:99.99]Bad\n[00:98.00]Worse\n[00:05.00]Also good\n[00:07.00]",
    );

    await expect.element(screen.getByRole("status")).toHaveTextContent("2 lines could not be read.");
  });

  it("shows no notice for valid input", async () => {
    const screen = await convertLrcInput("[00:01.00]Good\n[00:03.00]Also good\n[00:05.00]");

    await expect
      .poll(() => screen.container.querySelector("pre:not([aria-hidden])")?.textContent)
      .toContain("Also good</p>");
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

describe("converter highlighting", () => {
  function outputPane(container: HTMLElement): HTMLElement | null {
    return container.querySelector<HTMLElement>("pre:not([aria-hidden])");
  }

  it("highlights the input as it is typed", async () => {
    const screen = await renderLrcConverter();
    await screen.getByRole("textbox", { name: "Converter input" }).fill("[00:01.00]Hello");
    const layer = screen.container.querySelector(".bh-edit > .bh-layer");
    expect(layer?.textContent).toBe("[00:01.00]Hello");
    expect(layer?.querySelector(".bh-timestamp")?.textContent).toBe("00:01.00");
  });

  it("highlights the loaded sample in the input", async () => {
    const screen = await renderLrcConverter();
    await screen.getByRole("button", { name: "Load sample" }).click();
    await expect
      .poll(() => screen.container.querySelector(".bh-edit > .bh-layer")?.textContent)
      .toBe("[00:01.00]valid\n[00:03.00]second");
  });

  it("highlights the TTML output", async () => {
    const screen = await renderLrcConverter();
    await screen.getByRole("button", { name: "Load sample" }).click();
    await expect.poll(() => outputPane(screen.container)?.classList.contains("bh")).toBe(true);
    expect(outputPane(screen.container)?.querySelector(".bh-tag")?.textContent).toBe("tt");
  });

  it("shows the empty hint and errors as plain text", async () => {
    const screen = await render(
      <ConverterView
        title="LRC"
        inputLabel="LRC"
        inputPlaceholder="Paste LRC"
        inputExtension="lrc"
        sampleInput="[00:01.00] hello"
        convert={() => ({ error: "Could not parse line 3" })}
        outputFormat={TTML_OUTPUT}
      />,
      { withRouter: true },
    );
    expect(outputPane(screen.container)?.classList.contains("bh")).toBe(false);
    expect(outputPane(screen.container)?.textContent).toBe("Paste input to see TTML output");
    await screen.getByRole("button", { name: "Load sample" }).click();
    await expect.poll(() => outputPane(screen.container)?.textContent).toBe("Could not parse line 3");
    expect(outputPane(screen.container)?.classList.contains("bh")).toBe(false);
  });
});

describe("converter input resize", () => {
  it("regression: dragging the input's resize grip changes its height", async () => {
    const screen = await renderLrcConverter();
    const sheets = [installStyleSheet(LYRICS_CODE_CSS), await installUtilitiesUsedIn(screen.container)];
    try {
      const frame = screen.container.querySelector<HTMLElement>(".lyrics-code-frame");
      if (!frame) throw new Error("input frame not rendered");
      expect(getComputedStyle(frame).resize).toBe("vertical");
      const before = frame.getBoundingClientRect().height;
      frame.style.height = `${before + 200}px`;
      expect(frame.getBoundingClientRect().height).toBeCloseTo(before + 200, 0);
    } finally {
      for (const sheet of sheets) sheet.remove();
    }
  });
});

describe("loading a file into the converter", () => {
  function renderFileConverter() {
    return render(
      <ConverterView
        title="LRC"
        inputLabel="LRC"
        inputPlaceholder="Paste LRC"
        inputExtension="lrc"
        sampleInput="[00:01.00]valid"
        convert={convertLrc}
        outputFormat={TTML_OUTPUT}
      />,
      { withRouter: true },
    );
  }

  function dropFile(target: Element, file: File) {
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    target.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer }));
  }

  const LRC_FILE_TEXT = "[00:01.00]Dropped line\n[00:03.00]";

  it("fills the input from a file chosen with Load file", async () => {
    const screen = await renderFileConverter();
    const picker = screen.getByLabelText("Choose a .lrc file");

    await picker.upload(new File([LRC_FILE_TEXT], "song.lrc", { type: "text/plain" }));

    await expect.element(screen.getByRole("textbox", { name: "Converter input" })).toHaveValue(LRC_FILE_TEXT);
    await expect
      .poll(() => screen.container.querySelector("pre:not([aria-hidden])")?.textContent)
      .toContain("Dropped line");
  });

  it("offers the picker from a visible Load file button", async () => {
    const screen = await renderFileConverter();

    await expect.element(screen.getByRole("button", { name: "Load file" })).toBeInTheDocument();
    await expect.element(screen.getByLabelText("Choose a .lrc file")).toHaveAttribute("accept", ".lrc");
  });

  it("fills the input from a file dropped on the input card", async () => {
    const screen = await renderFileConverter();
    const textarea = screen.getByRole("textbox", { name: "Converter input" });

    dropFile(textarea.element(), new File([LRC_FILE_TEXT], "song.lrc", { type: "text/plain" }));

    await expect.element(textarea).toHaveValue(LRC_FILE_TEXT);
  });

  it("names the download after the loaded file with the output extension", async () => {
    const screen = await renderFileConverter();

    dropFile(
      screen.getByRole("textbox", { name: "Converter input" }).element(),
      new File([LRC_FILE_TEXT], "My Song.lrc", { type: "text/plain" }),
    );

    await expect.element(screen.getByRole("textbox", { name: "Filename" })).toHaveValue("My Song.ttml");
  });

  describe("error paths", () => {
    it("rejects a file of another format and keeps the current input", async () => {
      const screen = await renderFileConverter();
      const textarea = screen.getByRole("textbox", { name: "Converter input" });
      await textarea.fill("[00:01.00]typed");

      dropFile(textarea.element(), new File(["1\n00:00:01,000 --> 00:00:02,000\nhi"], "clip.srt"));

      await expect.element(screen.getByRole("alert")).toHaveTextContent("Use a .lrc file");
      await expect.element(textarea).toHaveValue("[00:01.00]typed");
      await expect.element(screen.getByRole("textbox", { name: "Filename" })).toHaveValue("lyrics.ttml");
    });

    it("clears the rejection once a valid file loads", async () => {
      const screen = await renderFileConverter();
      const textarea = screen.getByRole("textbox", { name: "Converter input" });

      dropFile(textarea.element(), new File(["x"], "clip.srt"));
      await expect.element(screen.getByRole("alert")).toBeInTheDocument();
      dropFile(textarea.element(), new File([LRC_FILE_TEXT], "song.lrc"));

      await expect.element(textarea).toHaveValue(LRC_FILE_TEXT);
      expect(screen.container.querySelector('[role="alert"]')).toBeNull();
    });

    it("ignores a drop that carries no file", async () => {
      const screen = await renderFileConverter();
      const textarea = screen.getByRole("textbox", { name: "Converter input" });
      await textarea.fill("[00:01.00]typed");

      textarea
        .element()
        .dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: new DataTransfer() }));

      await expect.element(textarea).toHaveValue("[00:01.00]typed");
    });
  });

  describe("edge cases", () => {
    it("accepts an upper-case extension", async () => {
      const screen = await renderFileConverter();
      const textarea = screen.getByRole("textbox", { name: "Converter input" });

      dropFile(textarea.element(), new File([LRC_FILE_TEXT], "SONG.LRC"));

      await expect.element(textarea).toHaveValue(LRC_FILE_TEXT);
    });

    it("accepts an .xml container on a page whose format QQ and Apple ship in XML", async () => {
      const screen = await render(
        <ConverterView
          title="TTML"
          inputLabel="TTML"
          inputPlaceholder="Paste TTML"
          inputExtension="ttml"
          sampleInput=""
          convert={() => ({ output: FAKE_TTML, projectPayload: "{}", skippedLines: 0 })}
          outputFormat={TTML_OUTPUT}
        />,
        { withRouter: true },
      );
      const textarea = screen.getByRole("textbox", { name: "Converter input" });

      dropFile(textarea.element(), new File([FAKE_TTML], "lyrics.xml"));

      await expect.element(textarea).toHaveValue(FAKE_TTML);
      await expect.element(screen.getByLabelText("Choose a .ttml file")).toHaveAttribute("accept", ".ttml,.xml");
    });
  });
});
