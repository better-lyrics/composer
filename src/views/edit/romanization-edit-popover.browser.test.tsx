import { userEvent } from "vitest/browser";
import { describe, expect, it } from "vitest";
import type { LyricLine } from "@/domain/line/model";
import { reconcileLine } from "@/domain/line/model";
import { useProjectStore } from "@/stores/project";
import { render } from "@/test/render";
import { RomanizationEditPopover } from "@/views/edit/romanization-edit-popover";

// -- Fixtures -----------------------------------------------------------------

function seedLine(opts: { romanizationText?: string; wordTexts?: string[] } = {}): LyricLine {
  useProjectStore.setState(useProjectStore.getInitialState());
  useProjectStore.getState().setLinesWithHistory([
    reconcileLine({
      id: "L1",
      text: "夜だけど",
      agentId: "v1",
      words: [
        { text: "夜", begin: 0, end: 1 },
        { text: "だけど", begin: 1, end: 2 },
      ],
    }),
  ]);
  if (opts.romanizationText !== undefined) {
    useProjectStore.getState().setLineRomanizationWithHistory("L1", {
      text: opts.romanizationText,
      ...(opts.wordTexts ? { wordTexts: opts.wordTexts } : {}),
      source: "generated",
    });
  }
  return useProjectStore.getState().lines[0];
}

// -- Tests --------------------------------------------------------------------

describe("RomanizationEditPopover open state", () => {
  it("initialises the textarea with the line's current romanization text", async () => {
    const line = seedLine({ romanizationText: "yoru dakedo" });
    const screen = await render(<RomanizationEditPopover line={line} isOpen onClose={() => {}} />);
    const textarea = screen.getByRole("textbox", { name: /romanization text/i });
    await expect.element(textarea).toHaveValue("yoru dakedo");
  });

  it("initialises the textarea with an empty string when no romanization is set", async () => {
    const line = seedLine();
    const screen = await render(<RomanizationEditPopover line={line} isOpen onClose={() => {}} />);
    const textarea = screen.getByRole("textbox", { name: /romanization text/i });
    await expect.element(textarea).toHaveValue("");
  });

  it("auto-focuses the textarea on mount", async () => {
    const line = seedLine({ romanizationText: "yoru dakedo" });
    const screen = await render(<RomanizationEditPopover line={line} isOpen onClose={() => {}} />);
    const textarea = screen.getByRole("textbox", { name: /romanization text/i });
    const el = textarea.element() as HTMLTextAreaElement;
    await expect.poll(() => document.activeElement).toBe(el);
  });
});

describe("RomanizationEditPopover save", () => {
  it("saves edited text with source=manual and no wordTexts", async () => {
    const line = seedLine({
      romanizationText: "old",
      wordTexts: ["o", "ld"],
    });
    let closed = false;
    const screen = await render(
      <RomanizationEditPopover
        line={line}
        isOpen
        onClose={() => {
          closed = true;
        }}
      />,
    );
    const textarea = screen.getByRole("textbox", { name: /romanization text/i });
    await textarea.fill("yoru dakedo");
    await screen.getByRole("button", { name: /save/i }).click();

    await expect.poll(() => useProjectStore.getState().lines[0].romanization?.text).toBe("yoru dakedo");
    expect(useProjectStore.getState().lines[0].romanization?.source).toBe("manual");
    expect(useProjectStore.getState().lines[0].romanization?.wordTexts).toBeUndefined();
    expect(closed).toBe(true);
  });

  it("saves an empty string and clears wordTexts", async () => {
    const line = seedLine({
      romanizationText: "yoru dakedo",
      wordTexts: ["yoru", "dakedo"],
    });
    const screen = await render(<RomanizationEditPopover line={line} isOpen onClose={() => {}} />);
    const textarea = screen.getByRole("textbox", { name: /romanization text/i });
    await textarea.fill("");
    await screen.getByRole("button", { name: /save/i }).click();

    await expect.poll(() => useProjectStore.getState().lines[0].romanization?.text).toBe("");
    expect(useProjectStore.getState().lines[0].romanization?.wordTexts).toBeUndefined();
    expect(useProjectStore.getState().lines[0].romanization?.source).toBe("manual");
  });
});

describe("RomanizationEditPopover dismiss", () => {
  it("cancel closes without writing to the store", async () => {
    const line = seedLine({ romanizationText: "yoru dakedo" });
    let closed = false;
    const screen = await render(
      <RomanizationEditPopover
        line={line}
        isOpen
        onClose={() => {
          closed = true;
        }}
      />,
    );
    const textarea = screen.getByRole("textbox", { name: /romanization text/i });
    await textarea.fill("something else");
    await screen.getByRole("button", { name: /cancel/i }).click();

    expect(closed).toBe(true);
    expect(useProjectStore.getState().lines[0].romanization?.text).toBe("yoru dakedo");
  });

  it("Escape closes the popover", async () => {
    const line = seedLine({ romanizationText: "yoru dakedo" });
    let closed = false;
    const screen = await render(
      <RomanizationEditPopover
        line={line}
        isOpen
        onClose={() => {
          closed = true;
        }}
      />,
    );
    const textarea = screen.getByRole("textbox", { name: /romanization text/i });
    await textarea.click();
    await userEvent.keyboard("{Escape}");
    await expect.poll(() => closed).toBe(true);
  });
});
