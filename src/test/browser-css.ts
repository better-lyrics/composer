import indexCss from "@/index.css?raw";
import highlightCss from "@braccato/highlight/highlight.css?raw";
import { compile } from "tailwindcss";
import tailwindThemeCss from "tailwindcss/theme.css?raw";

// The browser project has no Tailwind, so a rule a test observes is lifted from src/index.css and installed by hand.

// -- Constants -----------------------------------------------------------------

const WAVEFORM_SWEEP_ANIMATION = "waveform-loading-sweep";
const WAVEFORM_DOTS_UTILITY = "waveform-loading-dots";

// Without these the timeline layers stack in flow and push the rows past react-virtuoso's viewport.
const POSITION_UTILITIES_CSS = ".relative{position:relative}.absolute{position:absolute}.sticky{position:sticky;top:0}";

// Overlays only swallow clicks once they span their parent and their stacking order is real.
const HIT_TESTING_UTILITIES_CSS =
  ".inset-0{inset:0}.pointer-events-none{pointer-events:none}.pointer-events-auto{pointer-events:auto}.z-1{z-index:1}.z-2{z-index:2}";

// A capped, truncating label only caps and truncates once these utilities exist.
const TRUNCATION_UTILITIES_CSS =
  ".inline-flex{display:inline-flex}.min-w-0{min-width:0}.max-w-\\[380px\\]{max-width:380px}.truncate{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}";

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

async function installUtilitiesUsedIn(root: Element): Promise<HTMLStyleElement> {
  const classNames = new Set<string>();
  for (const element of [root, ...root.querySelectorAll("*")]) {
    for (const className of element.classList) classNames.add(className);
  }
  const compiler = await compile(`${tailwindThemeCss}\n@tailwind utilities;`);
  return installStyleSheet(compiler.build([...classNames]));
}

// -- Rules ---------------------------------------------------------------------

const THEME_TOKENS_CSS = `:root {${extractCssBlock(/@theme\s*\{/)}}`;

const TEXT_COLOR_UTILITIES_CSS =
  ".text-composer-text{color:var(--color-composer-text)}.text-composer-text-muted{color:var(--color-composer-text-muted)}.opacity-50{opacity:.5}";

// Help's content only scrolls once it is height-bound: the deferred host before OverlayScrollbars starts, the viewport after.
const HELP_CONTENT_SCROLLER_CSS = [
  "[data-overlayscrollbars-initialize]:not([data-overlayscrollbars]):has([data-help-content])",
  "[data-overlayscrollbars-viewport]",
]
  .join(",")
  .concat("{max-height:200px!important;overflow-y:scroll!important}");

const WAVEFORM_SWEEP_CSS = [utilityRule(WAVEFORM_DOTS_UTILITY), keyframesRule(WAVEFORM_SWEEP_ANIMATION)].join("\n");

const FLOATING_LAYER_CSS = utilityRule("layer-floating");

const LYRICS_CODE_CSS = [
  highlightCss,
  `.bh,.bh-edit {${extractCssBlock(/\.bh,\s*\.bh-edit\s*\{/)}}`,
  utilityRule("lyrics-code-surface"),
  utilityRule("lyrics-code-frame"),
].join("\n");

// -- Exports -------------------------------------------------------------------

export {
  FLOATING_LAYER_CSS,
  HELP_CONTENT_SCROLLER_CSS,
  HIT_TESTING_UTILITIES_CSS,
  installStyleSheet,
  installUtilitiesUsedIn,
  LYRICS_CODE_CSS,
  POSITION_UTILITIES_CSS,
  TEXT_COLOR_UTILITIES_CSS,
  THEME_TOKENS_CSS,
  TRUNCATION_UTILITIES_CSS,
  WAVEFORM_SWEEP_ANIMATION,
  WAVEFORM_SWEEP_CSS,
};
