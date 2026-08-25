import { afterEach, describe, expect, it } from "vitest";
import { buildPlayheadMask, playheadMaskRoot } from "@/views/timeline/timeline-playhead-mask";

// -- Constants -----------------------------------------------------------------

const PLAYHEAD_X = 300;
const CONTAINER_TOP = 100;

// -- Helpers -------------------------------------------------------------------

interface BlockRect {
  top: number;
  height: number;
  left: number;
  width: number;
}

function addWordBlock(parent: HTMLElement, rect: BlockRect, syllablePosition?: string): HTMLElement {
  const block = document.createElement("div");
  block.setAttribute("data-word-block", "");
  if (syllablePosition) block.dataset.syllablePosition = syllablePosition;
  block.getBoundingClientRect = () => new DOMRect(rect.left, rect.top, rect.width, rect.height);
  parent.appendChild(block);
  return block;
}

function addRoot(): HTMLElement {
  const root = document.createElement("div");
  document.body.appendChild(root);
  return root;
}

interface TimelineFixture {
  maskRoot: HTMLElement;
  scrollContainer: HTMLElement;
}

function addTimelineFixture(): TimelineFixture {
  const maskRoot = addRoot();
  maskRoot.dataset.timelineMaskRoot = "";
  const panel = document.createElement("div");
  panel.dataset.tour = "timeline-panel";
  maskRoot.appendChild(panel);
  const scrollContainer = document.createElement("div");
  panel.appendChild(scrollContainer);
  addWordBlock(scrollContainer, { top: 200, height: 40, left: 100, width: 400 });
  return { maskRoot, scrollContainer };
}

function addDragGhost(maskRoot: HTMLElement, rect: BlockRect): HTMLElement {
  const overlay = document.createElement("div");
  maskRoot.appendChild(overlay);
  addWordBlock(overlay, rect);
  return overlay;
}

afterEach(() => {
  document.body.replaceChildren();
});

// -- Tests ---------------------------------------------------------------------

describe("buildPlayheadMask", () => {
  it("returns an empty mask when the root holds no word block", () => {
    expect(buildPlayheadMask(addRoot(), PLAYHEAD_X, CONTAINER_TOP)).toBe("");
  });

  it("returns an empty mask when no word block spans the playhead", () => {
    const root = addRoot();
    addWordBlock(root, { top: 200, height: 40, left: 400, width: 100 });
    expect(buildPlayheadMask(root, PLAYHEAD_X, CONTAINER_TOP)).toBe("");
  });

  it("dims the band covered by a word block under the playhead", () => {
    const root = addRoot();
    addWordBlock(root, { top: 200, height: 40, left: 100, width: 400 });
    expect(buildPlayheadMask(root, PLAYHEAD_X, CONTAINER_TOP)).toBe(
      "linear-gradient(to bottom, black 0, black 100px, rgba(0,0,0,0.5) 100px, rgba(0,0,0,0.5) 140px, black 140px, black 100%)",
    );
  });

  it("merges word blocks whose bands touch", () => {
    const root = addRoot();
    addWordBlock(root, { top: 200, height: 40, left: 100, width: 400 });
    addWordBlock(root, { top: 230, height: 40, left: 100, width: 400 });
    expect(buildPlayheadMask(root, PLAYHEAD_X, CONTAINER_TOP)).toBe(
      "linear-gradient(to bottom, black 0, black 100px, rgba(0,0,0,0.5) 100px, rgba(0,0,0,0.5) 170px, black 170px, black 100%)",
    );
  });

  it("insets the band near a rounded corner", () => {
    const root = addRoot();
    addWordBlock(root, { top: 200, height: 40, left: PLAYHEAD_X - 2, width: 400 });
    const mask = buildPlayheadMask(root, PLAYHEAD_X, CONTAINER_TOP);
    expect(mask).not.toBe("");
    expect(mask).not.toContain("rgba(0,0,0,0.5) 100px");
  });

  it("keeps a joined syllable edge square", () => {
    const root = addRoot();
    addWordBlock(root, { top: 200, height: 40, left: PLAYHEAD_X - 2, width: 400 }, "last");
    expect(buildPlayheadMask(root, PLAYHEAD_X, CONTAINER_TOP)).toBe(
      "linear-gradient(to bottom, black 0, black 100px, rgba(0,0,0,0.5) 100px, rgba(0,0,0,0.5) 140px, black 140px, black 100%)",
    );
  });

  describe("root scoping", () => {
    it("matches a document-scoped query when every word block sits inside the root", () => {
      const root = addRoot();
      addWordBlock(root, { top: 200, height: 40, left: 100, width: 400 }, "first");
      addWordBlock(root, { top: 260, height: 40, left: 280, width: 60 }, "middle");
      addWordBlock(root, { top: 400, height: 40, left: 100, width: 400 });
      addWordBlock(root, { top: 500, height: 40, left: 900, width: 100 });

      expect(buildPlayheadMask(root, PLAYHEAD_X, CONTAINER_TOP)).toBe(
        buildPlayheadMask(document, PLAYHEAD_X, CONTAINER_TOP),
      );
    });

    it("excludes a word block rendered outside the root", () => {
      const root = addRoot();
      addWordBlock(root, { top: 200, height: 40, left: 100, width: 400 });
      const outsideRoot = addRoot();
      addWordBlock(outsideRoot, { top: 600, height: 40, left: 100, width: 400 });

      const scoped = buildPlayheadMask(root, PLAYHEAD_X, CONTAINER_TOP);
      const documentScoped = buildPlayheadMask(document, PLAYHEAD_X, CONTAINER_TOP);

      expect(scoped).not.toContain("500px");
      expect(documentScoped).toContain("500px");
    });
  });

  describe("playheadMaskRoot", () => {
    it("matches a document-scoped query while no word is being dragged", () => {
      const { scrollContainer } = addTimelineFixture();

      expect(buildPlayheadMask(playheadMaskRoot(scrollContainer), PLAYHEAD_X, CONTAINER_TOP)).toBe(
        buildPlayheadMask(document, PLAYHEAD_X, CONTAINER_TOP),
      );
    });

    it("matches a document-scoped query while a word is being dragged", () => {
      const { maskRoot, scrollContainer } = addTimelineFixture();
      addDragGhost(maskRoot, { top: 600, height: 40, left: 100, width: 400 });

      expect(buildPlayheadMask(playheadMaskRoot(scrollContainer), PLAYHEAD_X, CONTAINER_TOP)).toBe(
        buildPlayheadMask(document, PLAYHEAD_X, CONTAINER_TOP),
      );
    });

    it("regression: resolves the root without the product tour anchor", () => {
      const { maskRoot, scrollContainer } = addTimelineFixture();
      maskRoot.querySelector("[data-tour='timeline-panel']")?.removeAttribute("data-tour");
      addDragGhost(maskRoot, { top: 600, height: 40, left: 100, width: 400 });

      expect(playheadMaskRoot(scrollContainer)).toBe(maskRoot);
      expect(buildPlayheadMask(playheadMaskRoot(scrollContainer), PLAYHEAD_X, CONTAINER_TOP)).toBe(
        buildPlayheadMask(document, PLAYHEAD_X, CONTAINER_TOP),
      );
    });

    it("regression: the scroll container alone drops the drag ghost's band", () => {
      const { maskRoot, scrollContainer } = addTimelineFixture();
      addDragGhost(maskRoot, { top: 600, height: 40, left: 100, width: 400 });

      expect(buildPlayheadMask(scrollContainer, PLAYHEAD_X, CONTAINER_TOP)).not.toContain("500px");
      expect(buildPlayheadMask(playheadMaskRoot(scrollContainer), PLAYHEAD_X, CONTAINER_TOP)).toContain("500px");
    });

    it("counts a drag ghost overlapping the dragged word once", () => {
      const { maskRoot, scrollContainer } = addTimelineFixture();
      addDragGhost(maskRoot, { top: 210, height: 40, left: 100, width: 400 });

      expect(buildPlayheadMask(playheadMaskRoot(scrollContainer), PLAYHEAD_X, CONTAINER_TOP)).toBe(
        "linear-gradient(to bottom, black 0, black 100px, rgba(0,0,0,0.5) 100px, rgba(0,0,0,0.5) 150px, black 150px, black 100%)",
      );
    });

    it("falls back to the document when the mask root is missing", () => {
      const scrollContainer = addRoot();
      addWordBlock(scrollContainer, { top: 200, height: 40, left: 100, width: 400 });
      const outsideRoot = addRoot();
      addWordBlock(outsideRoot, { top: 600, height: 40, left: 100, width: 400 });

      expect(buildPlayheadMask(playheadMaskRoot(scrollContainer), PLAYHEAD_X, CONTAINER_TOP)).toBe(
        buildPlayheadMask(document, PLAYHEAD_X, CONTAINER_TOP),
      );
    });
  });

  describe("edge cases", () => {
    it("treats the left edge of a block as covered", () => {
      const root = addRoot();
      addWordBlock(root, { top: 200, height: 40, left: PLAYHEAD_X, width: 100 }, "middle");
      expect(buildPlayheadMask(root, PLAYHEAD_X, CONTAINER_TOP)).toContain("rgba(0,0,0,0.5) 100px");
    });

    it("treats the right edge of a block as covered", () => {
      const root = addRoot();
      addWordBlock(root, { top: 200, height: 40, left: PLAYHEAD_X - 100, width: 100 }, "middle");
      expect(buildPlayheadMask(root, PLAYHEAD_X, CONTAINER_TOP)).toContain("rgba(0,0,0,0.5) 100px");
    });

    it("orders bands top to bottom regardless of DOM order", () => {
      const root = addRoot();
      addWordBlock(root, { top: 400, height: 40, left: 100, width: 400 });
      addWordBlock(root, { top: 200, height: 40, left: 100, width: 400 });
      expect(buildPlayheadMask(root, PLAYHEAD_X, CONTAINER_TOP)).toBe(
        "linear-gradient(to bottom, black 0, black 100px, rgba(0,0,0,0.5) 100px, rgba(0,0,0,0.5) 140px, black 140px, black 300px, rgba(0,0,0,0.5) 300px, rgba(0,0,0,0.5) 340px, black 340px, black 100%)",
      );
    });
  });

  describe("invariants", () => {
    it("leaves the document untouched", () => {
      const root = addRoot();
      addWordBlock(root, { top: 200, height: 40, left: 100, width: 400 });
      const before = document.body.childElementCount;
      buildPlayheadMask(root, PLAYHEAD_X, CONTAINER_TOP);
      expect(document.body.childElementCount).toBe(before);
    });

    it("is idempotent for an unchanged root", () => {
      const root = addRoot();
      addWordBlock(root, { top: 200, height: 40, left: 100, width: 400 });
      expect(buildPlayheadMask(root, PLAYHEAD_X, CONTAINER_TOP)).toBe(
        buildPlayheadMask(root, PLAYHEAD_X, CONTAINER_TOP),
      );
    });
  });
});
