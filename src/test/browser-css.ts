import indexCss from "@/index.css?raw";

// The browser project has no Tailwind plugin, so a rule a test needs to observe has to be lifted
// out of the real src/index.css and installed by hand.

// -- Constants -----------------------------------------------------------------

const WAVEFORM_SWEEP_ANIMATION = "waveform-loading-sweep";
const WAVEFORM_DOTS_UTILITY = "waveform-loading-dots";

// Without these the timeline's layers all stack in flow, which pushes the rows past
// react-virtuoso's viewport and leaves it with nothing to render.
const POSITION_UTILITIES_CSS = ".relative{position:relative}.absolute{position:absolute}.sticky{position:sticky;top:0}";

// -- Helpers -------------------------------------------------------------------

function extractCssBlock(header: RegExp): string {
  const match = header.exec(indexCss);
  if (!match) throw new Error(`no CSS block matching ${header} in src/index.css`);
  const bodyStart = match.index + match[0].length;
  let depth = 1;
  for (let i = bodyStart; i < indexCss.length; i++) {
    if (indexCss[i] === "{") depth++;
    else if (indexCss[i] === "}" && --depth === 0) return indexCss.slice(bodyStart, i);
  }
  throw new Error(`unbalanced CSS block matching ${header} in src/index.css`);
}

function utilityRule(name: string): string {
  return `.${name} {${extractCssBlock(new RegExp(`@utility\\s+${name}\\s*\\{`))}}`;
}

function keyframesRule(name: string): string {
  return `@keyframes ${name} {${extractCssBlock(new RegExp(`@keyframes\\s+${name}\\s*\\{`))}}`;
}

function installStyleSheet(css: string): HTMLStyleElement {
  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);
  return style;
}

// -- Rules ---------------------------------------------------------------------

const WAVEFORM_SWEEP_CSS = [utilityRule(WAVEFORM_DOTS_UTILITY), keyframesRule(WAVEFORM_SWEEP_ANIMATION)].join("\n");

// -- Exports -------------------------------------------------------------------

export { installStyleSheet, POSITION_UTILITIES_CSS, WAVEFORM_SWEEP_ANIMATION, WAVEFORM_SWEEP_CSS };
