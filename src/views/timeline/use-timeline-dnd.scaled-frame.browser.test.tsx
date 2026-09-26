import type { LyricLine } from "@/domain/line/model";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { LineRow } from "@/views/timeline/line-row";
import { useTimelineDnd } from "@/views/timeline/use-timeline-dnd";
import {
  makeCursorTargetingEvent,
  makeCursorTargetingStartEvent,
} from "@/views/timeline/use-timeline-dnd.test-helpers";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { render } from "@/test/render";
import { beforeEach, describe, expect, it } from "vitest";

// -- Harness -------------------------------------------------------------------

interface Handlers {
  handleDragStart: ReturnType<typeof useTimelineDnd>["handleDragStart"];
  handleDragEnd: ReturnType<typeof useTimelineDnd>["handleDragEnd"];
}

// A scaled ancestor (how a browser/OS page-zoom scales the coordinate frame)
// makes getBoundingClientRect/clientY diverge from the timeline's unscaled row
// layout. The drop must still land on the row the cursor is visually over.
const ScaledRows: React.FC<{ lines: LyricLine[]; sink: Handlers }> = ({ lines, sink }) => {
  const dnd = useTimelineDnd(lines);
  sink.handleDragStart = dnd.handleDragStart;
  sink.handleDragEnd = dnd.handleDragEnd;
  return (
    <div style={{ transform: "scale(1.3)", transformOrigin: "top left" }}>
      <div data-scroll-container style={{ position: "relative" }}>
        <div style={{ height: 81 }} />
        {lines.map((line, index) => (
          <LineRow
            key={line.id}
            line={line}
            lineIndex={index}
            duration={30}
            onUpdateWord={() => {}}
            onUpdateBgWord={() => {}}
          />
        ))}
      </div>
    </div>
  );
};

function centerOfWord(text: string): { x: number; y: number } {
  const el = [...document.querySelectorAll<HTMLElement>("[data-word-block]")].find(
    (b) => b.textContent?.trim() === text,
  );
  if (!el) throw new Error(`no rendered word block "${text}"`);
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

// -- Tests ---------------------------------------------------------------------

describe("useTimelineDnd · drop target under a scaled frame", () => {
  beforeEach(() => {
    useAudioStore.setState({ duration: 30 });
    useTimelineStore.setState({ zoom: 100, rowHeights: {}, defaultRowHeight: 44, collapsedInstances: {} });
  });

  it("drops a word onto the line the cursor is visually over, not the one the unscaled model predicts", async () => {
    const lines: LyricLine[] = [
      {
        id: "l0",
        text: "alpha beta",
        agentId: "v1",
        words: [
          { text: "alpha ", begin: 0.1, end: 0.4 },
          { text: "beta", begin: 0.4, end: 0.7 },
        ],
      },
      { id: "l1", text: "gamma", agentId: "v1", words: [{ text: "gamma", begin: 5.0, end: 5.3 }] },
      { id: "l2", text: "delta", agentId: "v1", words: [{ text: "delta", begin: 10.0, end: 10.3 }] },
      { id: "l3", text: "epsilon", agentId: "v1", words: [{ text: "epsilon", begin: 15.0, end: 15.3 }] },
    ];
    useProjectStore.setState({ lines });

    const sink = {} as Handlers;
    await render(<ScaledRows lines={lines} sink={sink} />, { dndContext: true });

    const target = centerOfWord("delta");

    sink.handleDragStart(
      makeCursorTargetingStartEvent({
        lineId: "l0",
        lineIndex: 0,
        wordIndex: 0,
        trackType: "word",
        text: "alpha",
        begin: 0.1,
        end: 0.4,
        pointerX: target.x,
        pointerY: target.y,
      }),
    );
    window.dispatchEvent(new PointerEvent("pointermove", { clientX: target.x, clientY: target.y }));
    sink.handleDragEnd(
      makeCursorTargetingEvent({
        lineId: "l0",
        lineIndex: 0,
        wordIndex: 0,
        trackType: "word",
        text: "alpha",
        begin: 0.1,
        end: 0.4,
        pointerX: target.x,
        pointerY: target.y,
        deltaX: 0,
        deltaY: 0,
      }),
    );

    const after = useProjectStore.getState().lines;
    expect(after.find((l) => l.id === "l2")?.words?.some((w) => w.text.trim() === "alpha")).toBe(true);
    expect(after.find((l) => l.id === "l0")?.words?.length).toBe(1);
  });
});
