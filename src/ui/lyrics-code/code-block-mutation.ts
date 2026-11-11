// -- Functions ----------------------------------------------------------------

// A block's span is keyed by its text, so any change inside one is a highlight swap that keeps the text and size.
function isCodeBlockSwap(mutation: MutationRecord): boolean {
  const target = mutation.target instanceof Element ? mutation.target : mutation.target.parentElement;
  return target?.closest("[data-code-block]") != null;
}

// -- Exports ------------------------------------------------------------------

export { isCodeBlockSwap };
