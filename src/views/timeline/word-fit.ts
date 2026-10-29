// -- Types ---------------------------------------------------------------------

type WordFit = "full" | "narrow" | "tick";

interface WordLabelFit {
  fit: WordFit;
  // The label still overflows at the narrow size, so it fades out instead of ending mid-letter.
  cut: boolean;
}

// -- Constants -----------------------------------------------------------------

const TICK_WIDTH_PX = 20;
const LABEL_PADDING_PX = 18;
const NARROW_LABEL_PADDING_PX = 6;
const LABEL_FONT = "500 13px";
const NARROW_LABEL_FONT = "500 11px";

let measureContext: CanvasRenderingContext2D | null | undefined;
let fontFamily: string | undefined;
const MAX_CACHED_WIDTHS = 4096;
const cachedWidths = new Map<string, number>();
let clearsOnFontLoad = false;

// -- Functions -----------------------------------------------------------------

// Widths are cached only once fonts have loaded, so a fallback-face measurement never sticks.
function fontsSettled(): boolean {
  if (typeof document.fonts === "undefined") return false;
  if (!clearsOnFontLoad) {
    clearsOnFontLoad = true;
    document.fonts.addEventListener("loadingdone", () => cachedWidths.clear());
  }
  return document.fonts.status === "loaded";
}

function labelWidth(text: string, font: string): number {
  const key = `${font}|${text}`;
  const cached = cachedWidths.get(key);
  if (cached !== undefined) return cached;
  if (measureContext === undefined) measureContext = document.createElement("canvas").getContext("2d");
  if (!measureContext) return 0;
  fontFamily ??= getComputedStyle(document.documentElement).getPropertyValue("--font-sans") || "sans-serif";
  measureContext.font = `${font} ${fontFamily}`;
  const width = measureContext.measureText(text).width;
  if (!fontsSettled()) return width;
  if (cachedWidths.size >= MAX_CACHED_WIDTHS) cachedWidths.clear();
  cachedWidths.set(key, width);
  return width;
}

// A label that does not fit drops to a smaller face; a block too thin for any text shows none.
function wordFit(text: string, width: number): WordLabelFit {
  if (labelWidth(text, LABEL_FONT) + LABEL_PADDING_PX <= width) return { fit: "full", cut: false };
  if (width < TICK_WIDTH_PX) return { fit: "tick", cut: false };
  return { fit: "narrow", cut: labelWidth(text, NARROW_LABEL_FONT) + NARROW_LABEL_PADDING_PX > width };
}

// -- Exports -------------------------------------------------------------------

export { wordFit };
