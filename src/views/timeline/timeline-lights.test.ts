import { createTimelineLights, paintTimelineLights } from "@/views/timeline/timeline-lights";
import { describe, expect, it } from "vitest";

function rowWithWords(spans: readonly (readonly [begin: number, end: number])[]) {
  const row = document.createElement("div");
  row.setAttribute("data-timeline-row", "");
  const cell = document.createElement("div");
  cell.className = "line-cell";
  row.append(cell);
  const blocks = spans.map(([begin, end]) => {
    const block = document.createElement("div");
    block.setAttribute("data-word-block", "");
    block.dataset.begin = String(begin);
    block.dataset.end = String(end);
    row.append(block);
    return block;
  });
  document.body.replaceChildren(row);
  return { cell, blocks };
}

describe("regressions", () => {
  it("regression: restarts the hit flash when two words of one row light in the same frame", () => {
    const { cell, blocks } = rowWithWords([
      [1, 3],
      [2, 3],
      [2, 3],
    ]);
    const lights = createTimelineLights();

    paintTimelineLights(lights, document, blocks, [], 1.5);
    const first = cell.dataset.hit;
    paintTimelineLights(lights, document, blocks, [], 2.1);

    expect(cell.dataset.hit).not.toBe(first);
  });
});
