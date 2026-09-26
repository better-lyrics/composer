import { DndContext } from "@dnd-kit/core";
import { afterAll, beforeAll } from "vitest";
import type { LyricLine } from "@/domain/line/model";
import { HIT_TESTING_UTILITIES_CSS, installStyleSheet, POSITION_UTILITIES_CSS } from "@/test/browser-css";
import { DragGhost, TimelineDragOverlay } from "@/views/timeline/drag-ghost";
import { LineRow } from "@/views/timeline/line-row";
import { useTimelineDnd } from "@/views/timeline/use-timeline-dnd";

// -- Constants -----------------------------------------------------------------

const DND_LINES: LyricLine[] = [
  {
    id: "l0",
    text: "alpha beta",
    agentId: "v1",
    words: [
      { text: "alpha ", begin: 0.1, end: 0.4 },
      { text: "beta", begin: 0.4, end: 0.7 },
    ],
  },
  { id: "l1", text: "gamma", agentId: "v1", words: [{ text: "gamma", begin: 5, end: 5.3 }] },
];

const ACTIVATION_STEP_PX = 12;

// -- Helpers -------------------------------------------------------------------

function installTimelineLayoutStyles(): void {
  let styles: HTMLStyleElement[] = [];
  beforeAll(() => {
    styles = [installStyleSheet(POSITION_UTILITIES_CSS), installStyleSheet(HIT_TESTING_UTILITIES_CSS)];
  });
  afterAll(() => {
    for (const style of styles) style.remove();
  });
}

function trackRect(lineIndex: number, track: "word" | "bg"): DOMRect {
  const el = document.querySelector(`[data-line-index='${lineIndex}'][data-track='${track}']`);
  if (!el) throw new Error(`no ${track} track for line ${lineIndex}`);
  return el.getBoundingClientRect();
}

function wordBlock(text: string): HTMLElement {
  const el = [...document.querySelectorAll<HTMLElement>("[data-word-block]")].find(
    (block) => block.textContent?.trim() === text && !block.closest(".pointer-events-none"),
  );
  if (!el) throw new Error(`no word block "${text}"`);
  return el;
}

function pointer(type: string, x: number, y: number): PointerEvent {
  return new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: x,
    clientY: y,
    button: 0,
    isPrimary: true,
    pointerId: 1,
  });
}

function pressWord(text: string, grabOffsetY?: number): { x: number; y: number } {
  const rect = wordBlock(text).getBoundingClientRect();
  const start = { x: rect.left + rect.width / 2, y: rect.top + (grabOffsetY ?? rect.height / 2) };
  wordBlock(text).dispatchEvent(pointer("pointerdown", start.x, start.y));
  document.dispatchEvent(pointer("pointermove", start.x, start.y + ACTIVATION_STEP_PX));
  return start;
}

function movePointer(x: number, y: number): void {
  document.dispatchEvent(pointer("pointermove", x, y));
}

function releasePointer(x: number, y: number): void {
  document.dispatchEvent(pointer("pointerup", x, y));
}

// -- Components ----------------------------------------------------------------

const DndRows: React.FC<{ lines: LyricLine[] }> = ({ lines }) => {
  const { sensors, activeDrag, handleDragStart, handleDragEnd, handleDragCancel } = useTimelineDnd(lines);
  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div data-scroll-container className="relative">
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
      <TimelineDragOverlay>
        {activeDrag && (
          <DragGhost
            cells={[{ text: activeDrag.text, left: 0, top: 0, width: 60, height: 36, syllablePosition: "none" }]}
            anchorWidth={60}
            anchorHeight={36}
            color="#60a5fa"
            isSnapped={false}
          />
        )}
      </TimelineDragOverlay>
    </DndContext>
  );
};

// -- Exports -------------------------------------------------------------------

export { DND_LINES, DndRows, installTimelineLayoutStyles, movePointer, pressWord, releasePointer, trackRect };
