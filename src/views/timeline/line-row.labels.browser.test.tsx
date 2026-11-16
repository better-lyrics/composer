import { afterEach, expect, it } from "vitest";
import { useProjectStore } from "@/stores/project";
import { installUtilitiesUsedIn } from "@/test/browser-css";
import { createLine, createWord } from "@/test/factories";
import { render } from "@/test/render";
import { LineRow } from "@/views/timeline/line-row";
import { useTimelineStore } from "@/views/timeline/timeline-store";

// -- Constants ----------------------------------------------------------------

const DURATION = 30;
const GUTTER_WIDTH = 48;

// -- Helpers ------------------------------------------------------------------

let utilities: HTMLStyleElement | null = null;

afterEach(() => {
  utilities?.remove();
  utilities = null;
});

async function scrolledRow(line: ReturnType<typeof createLine>) {
  useProjectStore.setState({ lines: [line] });
  const width = GUTTER_WIDTH + DURATION * useTimelineStore.getState().zoom;
  const screen = await render(
    <div data-scroller style={{ width: 400, overflowX: "auto" }}>
      <div style={{ width }}>
        <LineRow line={line} lineIndex={0} duration={DURATION} onUpdateWord={() => {}} onUpdateBgWord={() => {}} />
      </div>
    </div>,
    { dndContext: true },
  );
  utilities = await installUtilitiesUsedIn(screen.container);
  const scroller = screen.container.querySelector<HTMLElement>("[data-scroller]");
  if (!scroller) throw new Error("no scroller");
  scroller.scrollLeft = 300;
  return screen.container;
}

// -- Tests --------------------------------------------------------------------

it("regression: an untimed background label stays beside the gutter on a timed line scrolled sideways", async () => {
  const container = await scrolledRow(
    createLine({
      text: "Morning",
      words: [createWord({ text: "Morning", begin: 1, end: 2 })],
      backgroundText: "(far away)",
    }),
  );
  const gutter = container.querySelector(".line-cell");
  const label = container.querySelector('[data-track="bg"] span');
  expect(label?.textContent).toBe("(far away)");
  expect(label!.getBoundingClientRect().left).toBeGreaterThanOrEqual(gutter!.getBoundingClientRect().right - 1);
});
