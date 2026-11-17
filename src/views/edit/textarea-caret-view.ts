import { rowAt, rowCount } from "@/domain/edit-text/text-rows";

// -- Constants ----------------------------------------------------------------

// The properties that decide where the textarea's text wraps and how tall its lines are.
const TEXT_LAYOUT_PROPERTIES = [
  "direction",
  "font-family",
  "font-feature-settings",
  "font-kerning",
  "font-size",
  "font-size-adjust",
  "font-stretch",
  "font-style",
  "font-variant",
  "font-variation-settings",
  "font-weight",
  "hyphens",
  "letter-spacing",
  "line-break",
  "line-height",
  "overflow-wrap",
  "padding-bottom",
  "padding-left",
  "padding-right",
  "padding-top",
  "tab-size",
  "text-indent",
  "text-rendering",
  "text-transform",
  "white-space",
  "word-break",
  "word-spacing",
  "writing-mode",
] as const;

// -- State --------------------------------------------------------------------

let textMirror: HTMLTextAreaElement | null = null;

// -- Functions ----------------------------------------------------------------

function connectedTextMirror(): HTMLTextAreaElement {
  if (textMirror?.isConnected) return textMirror;
  textMirror = document.createElement("textarea");
  textMirror.setAttribute("aria-hidden", "true");
  textMirror.tabIndex = -1;
  Object.assign(textMirror.style, {
    position: "absolute",
    visibility: "hidden",
    top: "0",
    left: "-9999px",
    height: "0",
    overflow: "hidden",
    boxSizing: "border-box",
    border: "0",
    contain: "strict",
  });
  document.body.appendChild(textMirror);
  return textMirror;
}

// How far down the text the caret's line ends. With no wrapped row every row is one line tall, so the caret's row
// says it; otherwise a hidden copy of the textarea holding the text before the caret measures it.
function caretLineBottom(textarea: HTMLTextAreaElement, style: CSSStyleDeclaration, lineHeight: number): number {
  const { value, selectionEnd } = textarea;
  const paddingTop = Number.parseFloat(style.paddingTop);
  const paddingBottom = Number.parseFloat(style.paddingBottom);
  const caretRow = rowAt(value, selectionEnd);
  const unwrappedHeight = paddingTop + rowCount(value) * lineHeight + paddingBottom;
  if (Math.abs(textarea.scrollHeight - unwrappedHeight) < lineHeight / 2)
    return paddingTop + (caretRow + 1) * lineHeight;
  const mirror = connectedTextMirror();
  for (const property of TEXT_LAYOUT_PROPERTIES) mirror.style.setProperty(property, style.getPropertyValue(property));
  mirror.style.width = `${textarea.clientWidth}px`;
  mirror.value = value.slice(0, selectionEnd);
  const bottom = mirror.scrollHeight - paddingBottom;
  mirror.value = "";
  return bottom;
}

// Scrolls the least that brings the caret's line into view; a caret already in view leaves the scroll alone.
function scrollCaretIntoView(textarea: HTMLTextAreaElement): void {
  if (textarea.scrollHeight <= textarea.clientHeight) return;
  const style = getComputedStyle(textarea);
  const lineHeight = Number.parseFloat(style.lineHeight) || Number.parseFloat(style.fontSize) * 1.2;
  const bottom = caretLineBottom(textarea, style, lineHeight);
  const top = bottom - lineHeight;
  if (top < textarea.scrollTop) textarea.scrollTop = top;
  else if (bottom > textarea.scrollTop + textarea.clientHeight) textarea.scrollTop = bottom - textarea.clientHeight;
}

// -- Exports ------------------------------------------------------------------

export { scrollCaretIntoView };
