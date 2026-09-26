import { describe, expect, it } from "vitest";
import { LyricSample, SyllableSample } from "@/best-practices/examples";
import { comesBefore } from "@/test/dom-order";
import { render } from "@/test/render";

// -- Helpers -------------------------------------------------------------------

function countOccurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

// -- Lyric sample --------------------------------------------------------------

describe("LyricSample", () => {
  it("renders the main line", async () => {
    const screen = await render(<LyricSample lines={[{ main: "I can't stop" }]} />);
    await expect.element(screen.getByText("I can't stop")).toBeInTheDocument();
  });

  it("renders the background under its main line", async () => {
    const screen = await render(<LyricSample lines={[{ main: "I can't stop", background: "(ooh yeah)" }]} />);
    await expect.element(screen.getByText("(ooh yeah)")).toBeInTheDocument();
  });

  it("renders an agent label when one is given", async () => {
    const screen = await render(<LyricSample lines={[{ agent: "Artist A", main: "I've been waiting" }]} />);
    await expect.element(screen.getByText("Artist A")).toBeInTheDocument();
  });

  it("renders a rest as its own row", async () => {
    const screen = await render(<LyricSample lines={[{ rest: "18 seconds of nothing" }]} />);
    await expect.element(screen.getByText("18 seconds of nothing")).toBeInTheDocument();
  });

  it("renders every row of a fully populated line", async () => {
    const screen = await render(
      <LyricSample lines={[{ agent: "Artist A", main: "I've been waiting", background: "(waiting on you)" }]} />,
    );
    await expect.element(screen.getByText("Artist A")).toBeInTheDocument();
    await expect.element(screen.getByText("I've been waiting")).toBeInTheDocument();
    await expect.element(screen.getByText("(waiting on you)")).toBeInTheDocument();
  });

  it("renders a spaced line without dropping its text", async () => {
    const screen = await render(
      <LyricSample
        lines={[{ main: "Last line of the verse" }, { agent: "Chorus", main: "I've been waiting", spaced: true }]}
      />,
    );
    await expect.element(screen.getByText("Last line of the verse")).toBeInTheDocument();
    await expect.element(screen.getByText("I've been waiting")).toBeInTheDocument();
  });
});

describe("LyricSample edge cases", () => {
  it("renders nothing for an empty line list", async () => {
    const screen = await render(<LyricSample lines={[]} />);
    expect(screen.container.textContent).toBe("");
  });

  it("renders a line carrying only an agent", async () => {
    const screen = await render(<LyricSample lines={[{ agent: "Feat. Artist B" }]} />);
    await expect.element(screen.getByText("Feat. Artist B")).toBeInTheDocument();
    expect(screen.container.textContent).toBe("Feat. Artist B");
  });

  it("renders a background with no main line above it", async () => {
    const screen = await render(<LyricSample lines={[{ background: "(uh, come on)" }]} />);
    await expect.element(screen.getByText("(uh, come on)")).toBeInTheDocument();
  });

  it("keeps an empty string out of the output", async () => {
    const screen = await render(<LyricSample lines={[{ main: "", background: "", agent: "", rest: "" }]} />);
    expect(screen.container.textContent).toBe("");
  });

  it("renders text carrying punctuation and non-latin characters verbatim", async () => {
    const nonLatin = "\u4F60\u597D, my love?";
    const screen = await render(<LyricSample lines={[{ main: nonLatin }]} />);
    await expect.element(screen.getByText(nonLatin)).toBeInTheDocument();
  });

  it("renders repeated identical lines once each", async () => {
    const screen = await render(<LyricSample lines={[{ main: "Ooh yeah" }, { main: "Ooh yeah" }]} />);
    expect(countOccurrences(screen.container.textContent ?? "", "Ooh yeah")).toBe(2);
  });
});

describe("LyricSample invariants", () => {
  it("places the agent above the main line", async () => {
    const screen = await render(<LyricSample lines={[{ agent: "Artist A", main: "I've been waiting" }]} />);
    const agent = screen.getByText("Artist A").element();
    const main = screen.getByText("I've been waiting").element();
    expect(comesBefore(agent, main)).toBe(true);
  });

  it("places the background below the main line", async () => {
    const screen = await render(<LyricSample lines={[{ main: "I can't stop", background: "(ooh yeah)" }]} />);
    const main = screen.getByText("I can't stop").element();
    const background = screen.getByText("(ooh yeah)").element();
    expect(comesBefore(main, background)).toBe(true);
  });

  it("keeps the background out of the main line element", async () => {
    const screen = await render(<LyricSample lines={[{ main: "I can't stop", background: "(ooh yeah)" }]} />);
    const main = screen.getByText("I can't stop").element();
    expect(main.textContent).toBe("I can't stop");
  });

  it("renders lines in the order they are given", async () => {
    const screen = await render(
      <LyricSample lines={[{ main: "I've been waiting" }, { main: "Where did you go, my love?" }]} />,
    );
    const first = screen.getByText("I've been waiting").element();
    const second = screen.getByText("Where did you go, my love?").element();
    expect(comesBefore(first, second)).toBe(true);
  });
});

// -- Syllable sample -----------------------------------------------------------

describe("SyllableSample", () => {
  it("renders each part separated by the cut marker", async () => {
    const screen = await render(<SyllableSample parts={["hel", "lo"]} caption="Cut on the syllable boundary" />);
    await expect.element(screen.getByText("hel")).toBeInTheDocument();
    await expect.element(screen.getByText("lo")).toBeInTheDocument();
    await expect.element(screen.getByText("Cut on the syllable boundary")).toBeInTheDocument();
  });

  it("renders a single unsplit word without a cut marker", async () => {
    const screen = await render(<SyllableSample parts={["beautiful"]} caption="Sung straight" />);
    await expect.element(screen.getByText("beautiful")).toBeInTheDocument();
    expect(screen.container.textContent).not.toContain("|");
  });
});

describe("SyllableSample edge cases", () => {
  it("renders no cut markers for an empty part list", async () => {
    const screen = await render(<SyllableSample parts={[]} caption="Nothing to split" />);
    await expect.element(screen.getByText("Nothing to split")).toBeInTheDocument();
    expect(screen.container.textContent).not.toContain("|");
  });

  it("renders two cut markers for three parts", async () => {
    const screen = await render(<SyllableSample parts={["beau", "ti", "ful"]} caption="Splitting by dictionary" />);
    expect(countOccurrences(screen.container.textContent ?? "", "|")).toBe(2);
  });

  it("renders repeated identical parts separately", async () => {
    const screen = await render(<SyllableSample parts={["la", "la", "la"]} caption="Held on one vowel" />);
    expect(countOccurrences(screen.container.textContent ?? "", "la")).toBe(3);
  });

  it("renders a part holding a stretched vowel verbatim", async () => {
    const screen = await render(<SyllableSample parts={["for", "eeeeever"]} caption="Spelling the stretch out" />);
    await expect.element(screen.getByText("eeeeever")).toBeInTheDocument();
  });

  it("renders an empty caption without emitting stray text", async () => {
    const screen = await render(<SyllableSample parts={["hel", "lo"]} caption="" />);
    expect(screen.container.textContent).toBe("hel|lo");
  });
});

describe("SyllableSample invariants", () => {
  it("emits one fewer cut marker than it has parts", async () => {
    for (const parts of [["a"], ["a", "b"], ["a", "b", "c"], ["a", "b", "c", "d"]]) {
      const screen = await render(<SyllableSample parts={parts} caption="" />);
      expect(countOccurrences(screen.container.textContent ?? "", "|")).toBe(parts.length - 1);
      await screen.unmount();
    }
  });

  it("places the caption after the syllable row", async () => {
    const screen = await render(<SyllableSample parts={["hel", "lo"]} caption="Cut on the syllable boundary" />);
    const part = screen.getByText("hel").element();
    const caption = screen.getByText("Cut on the syllable boundary").element();
    expect(comesBefore(part, caption)).toBe(true);
  });

  it("keeps the parts in the order they are given", async () => {
    const screen = await render(<SyllableSample parts={["hel", "lo"]} caption="" />);
    expect(screen.container.textContent).toBe("hel|lo");
  });
});
