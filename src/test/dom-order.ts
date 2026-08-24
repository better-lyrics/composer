// -- Document order assertions -------------------------------------------------
// Shared so tests that assert "X renders before Y" agree on what that means.

function comesBefore(first: Element, second: Element): boolean {
  return Boolean(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING);
}

export { comesBefore };
