import { afterEach, describe, expect, it } from "vitest";
import {
  createWordBlockBoxes,
  refreshWordBlockBoxes,
  releaseWordBlockBoxes,
  type WordBlockBoxes,
} from "@/views/timeline/word-block-boxes";

// -- Constants -----------------------------------------------------------------

const CONTAINER = { left: 50, top: 80, width: 1000, height: 600 };
const BLOCK_HEIGHT = 40;

// -- Helpers -------------------------------------------------------------------

interface Fixture {
  container: HTMLElement;
  scroll: { left: number; top: number };
  addBlock: (contentLeft: number, contentTop: number, width: number) => HTMLElement;
  rectReads: () => number;
}

function viewportBox(boxes: WordBlockBoxes): { left: number; right: number; top: number; bottom: number }[] {
  return boxes.boxes.map((box) => ({
    left: box.left + boxes.originLeft,
    right: box.right + boxes.originLeft,
    top: box.top + boxes.originTop,
    bottom: box.bottom + boxes.originTop,
  }));
}

function freshRects(fixture: Fixture): { left: number; right: number; top: number; bottom: number }[] {
  return [...fixture.container.querySelectorAll<HTMLElement>("[data-word-block]")].map((block) => {
    const { left, right, top, bottom } = block.getBoundingClientRect();
    return { left, right, top, bottom };
  });
}

function createFixture(): Fixture {
  const scroll = { left: 0, top: 0 };
  const container = document.createElement("div");
  container.getBoundingClientRect = () => new DOMRect(CONTAINER.left, CONTAINER.top, CONTAINER.width, CONTAINER.height);
  document.body.appendChild(container);
  let reads = 0;
  return {
    container,
    scroll,
    rectReads: () => reads,
    addBlock: (contentLeft, contentTop, width) => {
      const block = document.createElement("div");
      block.setAttribute("data-word-block", "");
      block.style.left = `${contentLeft}px`;
      block.style.width = `${width}px`;
      block.getBoundingClientRect = () => {
        reads++;
        return new DOMRect(
          CONTAINER.left + Number.parseFloat(block.style.left) - scroll.left,
          CONTAINER.top + contentTop - scroll.top,
          Number.parseFloat(block.style.width),
          BLOCK_HEIGHT,
        );
      };
      container.appendChild(block);
      return block;
    },
  };
}

let boxes = createWordBlockBoxes();

afterEach(() => {
  releaseWordBlockBoxes(boxes);
  boxes = createWordBlockBoxes();
  document.body.replaceChildren();
});

// -- Tests ---------------------------------------------------------------------

describe("refreshWordBlockBoxes", () => {
  it("follows a scroll without reading the blocks again, and matches a fresh read", () => {
    const fixture = createFixture();
    fixture.addBlock(100, 20, 300);
    fixture.addBlock(600, 70, 80);
    refreshWordBlockBoxes(boxes, fixture.container, fixture.scroll);
    const readsAfterMeasure = fixture.rectReads();

    fixture.scroll.left = 240.5;
    fixture.scroll.top = 33;
    refreshWordBlockBoxes(boxes, fixture.container, fixture.scroll);

    expect(fixture.rectReads()).toBe(readsAfterMeasure);
    expect(viewportBox(boxes)).toEqual(freshRects(fixture));
  });

  it("measures again after a block moves, but not after a playback light", () => {
    const fixture = createFixture();
    const block = fixture.addBlock(100, 20, 300);
    refreshWordBlockBoxes(boxes, fixture.container, fixture.scroll);
    const readsAfterMeasure = fixture.rectReads();

    block.setAttribute("data-lit", "");
    refreshWordBlockBoxes(boxes, fixture.container, fixture.scroll);
    expect(fixture.rectReads()).toBe(readsAfterMeasure);

    block.style.left = "180px";
    refreshWordBlockBoxes(boxes, fixture.container, fixture.scroll);
    expect(viewportBox(boxes)).toEqual(freshRects(fixture));
  });
});
