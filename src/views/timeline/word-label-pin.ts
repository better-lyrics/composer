// -- Constants -----------------------------------------------------------------

const LABEL_PADDING_PX = { full: 8, narrow: 3 } as const;
// Roughly two letters; a sliver narrower than this shows no label at all.
const MIN_LABEL_WIDTH_PX = 16;
// Reused every frame; the pass is synchronous, so one scratch set serves every caller.
const stillPinned = new Set<HTMLElement>();

// -- Functions -----------------------------------------------------------------

function labelPadding(block: HTMLElement): number {
  return block.dataset.fit === "narrow" ? LABEL_PADDING_PX.narrow : LABEL_PADDING_PX.full;
}

function unpin(label: HTMLElement): void {
  label.style.removeProperty("position");
  label.style.removeProperty("left");
  label.style.removeProperty("right");
  label.style.removeProperty("visibility");
  delete label.dataset.pinned;
}

// A word cut by the left edge of the lanes keeps its label in the visible part, as a lane header would.
function pinCutWordLabels(root: ParentNode, scrollLeft: number, pinned: Set<HTMLElement>): void {
  stillPinned.clear();
  for (const block of root.querySelectorAll<HTMLElement>("[data-word-block][data-begin]")) {
    const label = block.querySelector<HTMLElement>(":scope > span");
    if (!label) continue;
    const left = Number.parseFloat(block.style.left);
    const right = left + Number.parseFloat(block.style.width);
    if (!(left < scrollLeft && right > scrollLeft)) continue;
    const padding = labelPadding(block);
    label.dataset.pinned = "";
    label.style.position = "absolute";
    label.style.left = `${scrollLeft - left + padding}px`;
    label.style.right = `${padding}px`;
    label.style.visibility = right - scrollLeft - 2 * padding < MIN_LABEL_WIDTH_PX ? "hidden" : "";
    stillPinned.add(label);
  }
  for (const label of pinned) if (!stillPinned.has(label)) unpin(label);
  pinned.clear();
  for (const label of stillPinned) pinned.add(label);
  stillPinned.clear();
}

// -- Exports -------------------------------------------------------------------

export { pinCutWordLabels };
