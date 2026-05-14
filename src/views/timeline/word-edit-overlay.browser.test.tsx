import { describe, expect, it } from "vitest";
import { useRef } from "react";
import { WordEditOverlay } from "@/views/timeline/word-edit-overlay";
import { useProjectStore } from "@/stores/project";
import { createLine, createWord } from "@/test/factories";
import { render } from "@/test/render";

function Harness({ lineId }: { lineId: string }) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div ref={ref}>
      <WordEditOverlay lineId={lineId} wordIndex={0} type="word" scrollContainerRef={ref} />
    </div>
  );
}

describe("WordEditOverlay", () => {
  it("renders nothing when the target line does not exist", async () => {
    await render(<Harness lineId="nope" />);
    expect(document.querySelector("input")).toBeNull();
  });

  it("renders nothing when the word block is not present in the scroll container", async () => {
    const line = createLine({ words: [createWord({ text: "hello", begin: 0, end: 1 })] });
    useProjectStore.setState({ lines: [line] });
    await render(<Harness lineId={line.id} />);
    expect(document.querySelector("input")).toBeNull();
  });
});
