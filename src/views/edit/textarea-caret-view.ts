// -- Functions ----------------------------------------------------------------

// How far down the text the caret's line ends, read from a hidden copy of the textarea holding the text before it.
function caretLineBottom(textarea: HTMLTextAreaElement): { bottom: number; lineHeight: number } {
  const style = getComputedStyle(textarea);
  const copy = document.createElement("textarea");
  for (const property of style) copy.style.setProperty(property, style.getPropertyValue(property));
  Object.assign(copy.style, {
    position: "absolute",
    visibility: "hidden",
    top: "0",
    left: "-9999px",
    height: "0",
    overflow: "hidden",
    boxSizing: "border-box",
    borderLeftWidth: "0",
    borderRightWidth: "0",
    width: `${textarea.clientWidth}px`,
  });
  copy.value = textarea.value.slice(0, textarea.selectionEnd);
  document.body.appendChild(copy);
  const bottom = copy.scrollHeight - Number.parseFloat(style.paddingBottom);
  copy.remove();
  const lineHeight = Number.parseFloat(style.lineHeight) || Number.parseFloat(style.fontSize) * 1.2;
  return { bottom, lineHeight };
}

// Scrolls the least that brings the caret's line into view; a caret already in view leaves the scroll alone.
function scrollCaretIntoView(textarea: HTMLTextAreaElement): void {
  const { bottom, lineHeight } = caretLineBottom(textarea);
  const top = bottom - lineHeight;
  if (top < textarea.scrollTop) textarea.scrollTop = top;
  else if (bottom > textarea.scrollTop + textarea.clientHeight) textarea.scrollTop = bottom - textarea.clientHeight;
}

// -- Exports ------------------------------------------------------------------

export { scrollCaretIntoView };
