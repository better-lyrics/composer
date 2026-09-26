import { describe, expect, it } from "vitest";
import { WordRenderer } from "@/views/sync/word-renderer";
import { render } from "@/test/render";

describe("WordRenderer", () => {
  it("renders an unsynced word with text only", async () => {
    const screen = await render(
      <WordRenderer
        lineId="test-line"
        word="hello"
        idx={0}
        timing={undefined}
        allWords={undefined}
        handlers={{}}
        editMode={false}
      />,
    );
    expect(screen.container.textContent ?? "").toContain("hello");
  });

  it("renders a synced word with two time controls (begin and end)", async () => {
    const screen = await render(
      <WordRenderer
        lineId="test-line"
        word="hello"
        idx={0}
        timing={{ text: "hello", begin: 1, end: 2 }}
        allWords={[{ text: "hello", begin: 1, end: 2 }]}
        handlers={{}}
        editMode={false}
      />,
    );
    const inputs = screen.container.querySelectorAll("button");
    expect(inputs.length).toBeGreaterThanOrEqual(3);
  });

  it("shows a warning icon when begin === end (zero duration)", async () => {
    const screen = await render(
      <WordRenderer
        lineId="test-line"
        word="hello"
        idx={0}
        timing={{ text: "hello", begin: 1.5, end: 1.5 }}
        allWords={[{ text: "hello", begin: 1.5, end: 1.5 }]}
        handlers={{}}
        editMode={false}
      />,
    );
    expect(screen.container.querySelector(".text-composer-warning")).not.toBeNull();
  });

  it("renders background style (italic) when isBackground is true", async () => {
    const screen = await render(
      <WordRenderer
        lineId="test-line"
        word="(echo)"
        idx={0}
        timing={{ text: "(echo)", begin: 1, end: 2 }}
        allWords={[{ text: "(echo)", begin: 1, end: 2 }]}
        handlers={{}}
        isBackground
        editMode={false}
      />,
    );
    const italic = screen.container.querySelector(".italic");
    expect(italic).not.toBeNull();
  });

  // -- Re-record affordance ---------------------------------------------------

  it("exposes a timed word as a re-record button", async () => {
    const screen = await render(
      <WordRenderer
        lineId="test-line"
        word="hello"
        idx={2}
        timing={{ text: "hello", begin: 1, end: 2 }}
        allWords={[{ text: "hello", begin: 1, end: 2 }]}
        handlers={{ onClickWord: () => {} }}
        editMode={false}
      />,
    );
    await expect.element(screen.getByTitle("Re-record from this word")).toBeInTheDocument();
  });

  it("reports its own index when clicked", async () => {
    const clicked: number[] = [];
    const screen = await render(
      <WordRenderer
        lineId="test-line"
        word="hello"
        idx={3}
        timing={{ text: "hello", begin: 1, end: 2 }}
        allWords={[{ text: "hello", begin: 1, end: 2 }]}
        handlers={{ onClickWord: (idx) => clicked.push(idx) }}
        editMode={false}
      />,
    );
    await screen.getByTitle("Re-record from this word").click();
    expect(clicked).toEqual([3]);
  });

  it("regression: leaves an untimed word non-interactive so a tap cannot desync the words array", async () => {
    const screen = await render(
      <WordRenderer
        lineId="test-line"
        word="hello"
        idx={2}
        timing={undefined}
        allWords={undefined}
        handlers={{ onClickWord: () => {} }}
        editMode={false}
      />,
    );
    expect(screen.container.querySelector("button")).toBeNull();
  });

  it("labels a background word as a jump rather than a re-record", async () => {
    const screen = await render(
      <WordRenderer
        lineId="test-line"
        word="(echo)"
        idx={0}
        timing={{ text: "(echo)", begin: 1, end: 2 }}
        allWords={[{ text: "(echo)", begin: 1, end: 2 }]}
        handlers={{ onClickWord: () => {} }}
        isBackground
        editMode={false}
      />,
    );
    await expect.element(screen.getByTitle("Jump to this word")).toBeInTheDocument();
  });
});
