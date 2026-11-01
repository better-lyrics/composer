import type { TokenType } from "@braccato/highlight";

// -- Helpers ------------------------------------------------------------------

function documentOrder(a: AbstractRange, b: AbstractRange): number {
  if (a.startContainer === b.startContainer) return a.startOffset - b.startOffset;
  return a.startContainer.compareDocumentPosition(b.startContainer) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
}

function editorHighlightTexts(layer: Element, type: TokenType): string[] {
  const ranges = [...(CSS.highlights.get(`bh-${type}`) ?? [])].filter((range) => layer.contains(range.startContainer));
  return ranges
    .toSorted(documentOrder)
    .map((range) => (range.startContainer.textContent ?? "").slice(range.startOffset, range.endOffset));
}

// -- Exports -------------------------------------------------------------------

export { editorHighlightTexts };
