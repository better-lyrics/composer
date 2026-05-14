import { describe, expect, it } from "vitest";
import { WordTrack } from "@/views/timeline/word-track";
import { useProjectStore } from "@/stores/project";
import { createLine, createWord } from "@/test/factories";
import { render } from "@/test/render";

const WORDS = [
  createWord({ text: "hello ", begin: 0, end: 1 }),
  createWord({ text: "world", begin: 1, end: 2 }),
];

describe("WordTrack", () => {
  it("renders one WordBlock per word", async () => {
    const line = createLine({ words: WORDS });
    useProjectStore.setState({ lines: [line] });
    const screen = await render(
      <WordTrack
        lineId={line.id}
        lineIndex={0}
        words={WORDS}
        color="#a3c9ff"
        trackType="word"
        duration={2}
        height={32}
        onUpdateWord={() => {}}
      />,
      { dndContext: true },
    );
    expect(screen.container.querySelectorAll("[data-word-block]").length).toBe(WORDS.length);
  });

  it("sizes the track container to duration × zoom", async () => {
    const line = createLine({ words: WORDS });
    useProjectStore.setState({ lines: [line] });
    const screen = await render(
      <WordTrack
        lineId={line.id}
        lineIndex={0}
        words={WORDS}
        color="#a3c9ff"
        trackType="word"
        duration={2}
        height={32}
        onUpdateWord={() => {}}
      />,
      { dndContext: true },
    );
    const track = screen.container.querySelector(".relative") as HTMLElement;
    expect(track.style.height).toBe("32px");
  });
});
