import { describe, expect, it } from "vitest";
import { TimingSample } from "@/best-practices/examples";
import { comesBefore } from "@/test/dom-order";
import { render } from "@/test/render";

function countOccurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

describe("TimingSample", () => {
  it("renders a labelled block for each word", async () => {
    const screen = await render(
      <TimingSample
        caption="Kept"
        cells={[
          { kind: "word", label: "I" },
          { kind: "word", label: "can't" },
        ]}
      />,
    );
    await expect.element(screen.getByText("I")).toBeInTheDocument();
    await expect.element(screen.getByText("can't")).toBeInTheDocument();
    await expect.element(screen.getByText("Kept")).toBeInTheDocument();
  });

  it("groups cells into a paragraph box when a group is given", async () => {
    const screen = await render(
      <TimingSample
        caption="One paragraph"
        cells={[
          {
            kind: "group",
            cells: [
              { kind: "word", label: "verse line" },
              { kind: "gap", width: "sm" },
            ],
          },
        ]}
      />,
    );
    await expect.element(screen.getByText("verse line")).toBeInTheDocument();
  });

  it("renders a highlighted block with its label intact", async () => {
    const screen = await render(
      <TimingSample caption="Held" cells={[{ kind: "word", label: "stop", highlighted: true }]} />,
    );
    await expect.element(screen.getByText("stop")).toBeInTheDocument();
  });

  it("renders a wide block with its label intact", async () => {
    const screen = await render(
      <TimingSample caption="Stretched" cells={[{ kind: "word", label: "verse line", wide: true }]} />,
    );
    await expect.element(screen.getByText("verse line")).toBeInTheDocument();
  });
});

describe("TimingSample edge cases", () => {
  it("renders the caption alone for an empty cell list", async () => {
    const screen = await render(<TimingSample caption="Nothing timed" cells={[]} />);
    expect(screen.container.textContent).toBe("Nothing timed");
  });

  it("renders a gap on both sides of a grouped word", async () => {
    const screen = await render(
      <TimingSample
        caption="Isolated paragraph"
        cells={[
          { kind: "gap", width: "lg" },
          { kind: "group", cells: [{ kind: "word", label: "yeah!" }] },
          { kind: "gap", width: "lg" },
        ]}
      />,
    );
    await expect.element(screen.getByText("yeah!")).toBeInTheDocument();
    expect(screen.container.textContent).toBe("yeah!Isolated paragraph");
  });

  it("renders nested groups down to the innermost label", async () => {
    const screen = await render(
      <TimingSample
        caption="Nested"
        cells={[
          {
            kind: "group",
            cells: [
              { kind: "group", cells: [{ kind: "word", label: "inner" }] },
              { kind: "word", label: "outer" },
            ],
          },
        ]}
      />,
    );
    await expect.element(screen.getByText("inner")).toBeInTheDocument();
    await expect.element(screen.getByText("outer")).toBeInTheDocument();
  });

  it("renders an empty group without dropping the rest of the strip", async () => {
    const screen = await render(
      <TimingSample
        caption="Empty paragraph"
        cells={[
          { kind: "group", cells: [] },
          { kind: "word", label: "after" },
        ]}
      />,
    );
    await expect.element(screen.getByText("after")).toBeInTheDocument();
  });

  it("renders repeated identical labels once each", async () => {
    const screen = await render(
      <TimingSample
        caption="Doubled"
        cells={[
          { kind: "word", label: "la" },
          { kind: "word", label: "la" },
        ]}
      />,
    );
    expect(countOccurrences(screen.container.textContent ?? "", "la")).toBe(2);
  });
});

describe("TimingSample invariants", () => {
  it("contributes no text for gap cells", async () => {
    const screen = await render(
      <TimingSample
        caption="Breath"
        cells={[
          { kind: "word", label: "stop" },
          { kind: "gap", width: "lg" },
          { kind: "word", label: "think" },
        ]}
      />,
    );
    expect(screen.container.textContent).toBe("stopthinkBreath");
  });

  it("places the caption after the strip", async () => {
    const screen = await render(<TimingSample caption="Kept" cells={[{ kind: "word", label: "I" }]} />);
    const block = screen.getByText("I").element();
    const caption = screen.getByText("Kept").element();
    expect(comesBefore(block, caption)).toBe(true);
  });

  it("keeps cells in the order they are given", async () => {
    const screen = await render(
      <TimingSample
        caption=""
        cells={[
          { kind: "word", label: "think" },
          { kind: "word", label: "ing" },
        ]}
      />,
    );
    expect(screen.container.textContent).toBe("thinking");
  });
});
