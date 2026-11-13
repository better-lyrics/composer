import { useEffect, useRef, useState } from "react";
import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { lineText } from "@/domain/line/text";
import { mainTrack, roleWords } from "@/domain/line/track";
import { useProjectStore } from "@/stores/project";
import { createLine, createWord } from "@/test/factories";
import { render } from "@/test/render";
import { wordAddress } from "@/test/word-address";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { WordEditOverlay } from "@/views/timeline/word-edit-overlay";

function firstWordId(lineId: string): string {
  const line = useProjectStore.getState().lines.find((candidate) => candidate.id === lineId);
  return line ? wordAddress(line, 0).syllableId : `${lineId}-missing`;
}

function BareHarness({ lineId }: { lineId: string }) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div ref={ref}>
      <WordEditOverlay lineId={lineId} syllableId={firstWordId(lineId)} type="word" scrollContainerRef={ref} />
    </div>
  );
}

function PositionedHarness({ lineId, wordKey }: { lineId: string; wordKey: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  return (
    <div ref={ref} style={{ position: "relative", width: 800, height: 200 }}>
      <div
        data-word-block
        id={wordKey}
        style={{ position: "absolute", left: "0px", top: "100px", width: "60px", height: "20px" }}
      />
      {mounted && (
        <WordEditOverlay lineId={lineId} syllableId={firstWordId(lineId)} type="word" scrollContainerRef={ref} />
      )}
    </div>
  );
}

describe("WordEditOverlay", () => {
  it("renders nothing when the target line does not exist", async () => {
    await render(<BareHarness lineId="nope" />);
    expect(document.querySelector("input")).toBeNull();
  });

  it("renders nothing when the word block is not present in the scroll container", async () => {
    const line = createLine({ words: [createWord({ text: "hello", begin: 0, end: 1 })] });
    useProjectStore.setState({ lines: [line] });
    await render(<BareHarness lineId={line.id} />);
    expect(document.querySelector("input")).toBeNull();
  });

  it("labels the edit input once positioned over a word block", async () => {
    const line = createLine({ id: "line-1", words: [createWord({ text: "hello", begin: 0, end: 1 })] });
    useProjectStore.setState({ lines: [line] });
    useTimelineStore.setState({ zoom: 100 });
    const screen = await render(<PositionedHarness lineId={line.id} wordKey={`${line.id}-word-0`} />);
    await expect.element(screen.getByRole("textbox", { name: "Edit word" })).toBeInTheDocument();
  });

  it("regression: renaming the word of a line-synced row keeps it line-synced with the new text", async () => {
    const line = createLine({ id: "ls", text: "Old words", begin: 0, end: 3 });
    useProjectStore.setState({ lines: [line] });
    useTimelineStore.setState({ zoom: 100 });
    const screen = await render(<PositionedHarness lineId={line.id} wordKey={`${line.id}-word-0`} />);

    await screen.getByRole("textbox", { name: "Edit word" }).fill("New words");
    await userEvent.keyboard("{Enter}");

    await expect.poll(() => lineText(useProjectStore.getState().lines[0])).toBe("New words");
    const after = useProjectStore.getState().lines[0];
    expect(roleWords(after, "main")).toBeUndefined();
    expect(mainTrack(after).begin).toBe(0);
    expect(mainTrack(after).end).toBe(3);
  });
});
