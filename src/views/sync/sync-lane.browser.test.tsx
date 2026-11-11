import type { LyricLine } from "@/domain/line/model";
import { installUtilitiesUsedIn } from "@/test/browser-css";
import { createLine } from "@/test/factories";
import { stepFrames } from "@/test/frame-steps";
import { render } from "@/test/render";
import { buildLaneRows } from "@/views/sync/lane-rows";
import { SyncLane } from "@/views/sync/sync-lane";
import { describe, expect, it } from "vitest";

// -- Helpers ------------------------------------------------------------------

const LANE_HEIGHT_PX = 600;
const IN_PLACE_WITHIN_PX = 30;

const lines: LyricLine[] = Array.from({ length: 2000 }, (_, index) =>
  createLine({ text: `Line ${index + 1} ${"walking under neon ".repeat(1 + (index % 7))}`.trim() }),
);
const rows = buildLaneRows({ lines, displayLines: [], agents: [], groupTags: new Map(), folded: new Set() });

function lane(lineIndex: number, laneRows = rows) {
  return (
    <div style={{ height: LANE_HEIGHT_PX, display: "flex", flexDirection: "column" }}>
      <SyncLane
        rows={laneRows}
        lineIndex={lineIndex}
        wordIndex={0}
        granularity="line"
        isHolding={false}
        placingLineIndex={null}
        ring={null}
        onRingDone={() => {}}
      />
    </div>
  );
}

// Tailwind is compiled from a first mount, so the lane is height-bound and its transitions are real.
async function renderBoundedLane(lineIndex: number) {
  const first = await render(lane(0));
  await installUtilitiesUsedIn(first.container);
  await first.unmount();
  return render(lane(lineIndex));
}

function rowOffsetFromCentre(container: HTMLElement, lineNumber: number): number {
  const row = [...container.querySelectorAll("[dir=auto]")].find((line) =>
    line.textContent?.startsWith(`Line ${lineNumber} `),
  );
  const host = container.querySelector(".overflow-hidden");
  if (!row || !host) return Number.POSITIVE_INFINITY;
  const rowRect = row.getBoundingClientRect();
  const hostRect = host.getBoundingClientRect();
  return Math.abs(rowRect.top + rowRect.height / 2 - (hostRect.top + hostRect.height / 2));
}

// -- Tests --------------------------------------------------------------------

describe("SyncLane", () => {
  it("regression: far down the song the lane mounts in place and a step glides from where it is", async () => {
    const screen = await renderBoundedLane(1400);
    await stepFrames(1);
    expect(rowOffsetFromCentre(screen.container, 1401)).toBeLessThan(IN_PLACE_WITHIN_PX);

    await screen.rerender(lane(1401));
    expect(rowOffsetFromCentre(screen.container, 1401)).toBeLessThan(IN_PLACE_WITHIN_PX);
    await expect.poll(() => rowOffsetFromCentre(screen.container, 1402)).toBeLessThan(1);
  });

  it("regression: a line inserted above keeps the current line in place", async () => {
    const screen = await renderBoundedLane(1400);
    await stepFrames(1);
    expect(rowOffsetFromCentre(screen.container, 1401)).toBeLessThan(IN_PLACE_WITHIN_PX);

    const inserted = [...lines.slice(0, 2), createLine({ text: "A new line sung softly" }), ...lines.slice(2)];
    const insertedRows = buildLaneRows({
      lines: inserted,
      displayLines: [],
      agents: [],
      groupTags: new Map(),
      folded: new Set(),
    });
    await screen.rerender(lane(1401, insertedRows));
    expect(rowOffsetFromCentre(screen.container, 1401)).toBeLessThan(IN_PLACE_WITHIN_PX);
  });
});
