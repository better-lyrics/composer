import { render } from "@/test/render";
import { SplitPicker, SplitPickerLegend, separatorKinds } from "@/ui/split-picker";
import { describe, expect, it } from "vitest";

// -- Tests --------------------------------------------------------------------

describe("SplitPicker", () => {
  it("renders a split point between each pair of letters", async () => {
    const screen = await render(<SplitPicker value="abc" points={[]} onToggle={() => {}} label="Text" />);
    await expect.element(screen.getByRole("button", { name: "Text split point 1" })).toBeInTheDocument();
    await expect.element(screen.getByRole("button", { name: "Text split point 2" })).toBeInTheDocument();
    expect(screen.container.querySelector('button[aria-label="Text split point 3"]')).toBeNull();
  });

  it("reports the toggled point and reflects selection with aria-pressed", async () => {
    const toggled: number[] = [];
    const screen = await render(
      <SplitPicker value="abc" points={[2]} onToggle={(point) => toggled.push(point)} label="Text" />,
    );
    await expect
      .element(screen.getByRole("button", { name: "Text split point 2" }))
      .toHaveAttribute("aria-pressed", "true");
    await screen.getByRole("button", { name: "Text split point 1" }).click();
    expect(toggled).toEqual([1]);
  });

  it("tells a pronunciation break from a word break", async () => {
    const screen = await render(
      <SplitPicker value="bam ha  neul" points={[]} onToggle={() => {}} label="Transliteration" />,
    );
    const pronunciation = screen.getByRole("button", { name: "Transliteration pronunciation break 4" });
    const word = screen.getByRole("button", { name: "Transliteration word break 8" });
    await expect.element(pronunciation).toHaveClass("w-8");
    await expect.element(word).toHaveClass("w-12");
  });

  it("shows a visible caption only when given one", async () => {
    const screen = await render(
      <SplitPicker value="ab" points={[]} onToggle={() => {}} label="Original" caption="Original" />,
    );
    await expect.element(screen.getByText("Original", { exact: true })).toBeInTheDocument();
  });

  describe("dash modes", () => {
    it("treats a dash as an untimed separator by default", async () => {
      const screen = await render(<SplitPicker value="to-do" points={[]} onToggle={() => {}} label="Text" />);
      await expect.element(screen.getByRole("button", { name: "Text dash 3" })).toBeInTheDocument();
      expect(screen.container.querySelector('button[aria-label="Text split point 2"]')).toBeNull();
    });

    it("treats a dash as a letter in literal mode", async () => {
      const screen = await render(
        <SplitPicker value="to-do" points={[]} onToggle={() => {}} label="Transliteration" dashes="literal" />,
      );
      await expect.element(screen.getByRole("button", { name: "Transliteration split point 2" })).toBeInTheDocument();
      await expect.element(screen.getByRole("button", { name: "Transliteration split point 3" })).toBeInTheDocument();
      expect(screen.container.querySelector('button[aria-label^="Transliteration dash"]')).toBeNull();
    });
  });

  describe("edge cases", () => {
    it("renders no separator button at the start or end of the value", async () => {
      const screen = await render(<SplitPicker value=" ab " points={[]} onToggle={() => {}} label="Text" />);
      expect(screen.container.querySelectorAll('button[aria-label*="break"]')).toHaveLength(0);
      await expect.element(screen.getByRole("button", { name: "Text split point 2" })).toBeInTheDocument();
    });

    it("keeps combining marks inside one grapheme", async () => {
      const screen = await render(<SplitPicker value={"éa"} points={[]} onToggle={() => {}} label="Text" />);
      expect(screen.container.querySelector('button[aria-label="Text split point 1"]')).toBeNull();
      await expect.element(screen.getByRole("button", { name: "Text split point 2" })).toBeInTheDocument();
    });

    it("renders nothing to click for a single letter", async () => {
      const screen = await render(<SplitPicker value="a" points={[]} onToggle={() => {}} label="Text" />);
      expect(screen.container.querySelectorAll("button")).toHaveLength(0);
    });

    it("renders nothing to click for an empty value", async () => {
      const screen = await render(<SplitPicker value="" points={[]} onToggle={() => {}} label="Text" />);
      expect(screen.container.querySelectorAll("button")).toHaveLength(0);
    });
  });

  describe("regressions", () => {
    it("regression: a mixed dash and space run is one separator, not two", async () => {
      const screen = await render(<SplitPicker value="to- do" points={[]} onToggle={() => {}} label="Text" />);
      expect(
        screen.container.querySelectorAll('button[aria-label*="break"], button[aria-label*=" dash "]'),
      ).toHaveLength(1);
    });
  });
});

describe("separatorKinds", () => {
  it("lists the kinds present in fixed order", () => {
    expect(separatorKinds(["a  b c-d"])).toEqual(["pronunciation", "word", "dash"]);
  });

  it("ignores separators at the edges", () => {
    expect(separatorKinds([" ab "])).toEqual([]);
  });

  it("does not report dashes in literal mode", () => {
    expect(separatorKinds(["to-do"], "literal")).toEqual([]);
  });

  it("merges several values without inventing a separator between them", () => {
    expect(separatorKinds(["ab", "c d"])).toEqual(["pronunciation"]);
  });
});

describe("SplitPickerLegend", () => {
  it("names each kind and summarizes that none are timed", async () => {
    const screen = await render(<SplitPickerLegend kinds={["pronunciation", "word"]} />);
    await expect.element(screen.getByText("Pronunciation break")).toBeInTheDocument();
    await expect.element(screen.getByText("Word break")).toBeInTheDocument();
    await expect.element(screen.getByText("Neither is timed.")).toBeInTheDocument();
  });

  it("uses singular and plural summaries", async () => {
    const one = await render(<SplitPickerLegend kinds={["word"]} />);
    await expect.element(one.getByText("Not timed.")).toBeInTheDocument();
    await one.unmount();
    const three = await render(<SplitPickerLegend kinds={["pronunciation", "word", "dash"]} />);
    await expect.element(three.getByText("None are timed.")).toBeInTheDocument();
  });

  it("explains a kind in a tooltip on hover", async () => {
    const screen = await render(<SplitPickerLegend kinds={["word"]} />);
    await screen.getByText("Word break").hover();
    await expect.element(screen.getByRole("tooltip")).toHaveTextContent("Two spaces between words.");
  });

  it("explains a kind in a tooltip on keyboard focus", async () => {
    const screen = await render(<SplitPickerLegend kinds={["word"]} />);
    const trigger = screen.getByRole("button", { name: "Word break" });
    (trigger.element() as HTMLButtonElement).focus();
    expect(document.activeElement).toBe(trigger.element());
    await expect.element(screen.getByRole("tooltip")).toHaveTextContent("Two spaces between words.");
  });

  it("renders nothing when there are no separators", async () => {
    const screen = await render(<SplitPickerLegend kinds={[]} />);
    expect(screen.container.textContent).toBe("");
  });
});
