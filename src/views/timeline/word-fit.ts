import type { WordTrackType } from "@/views/timeline/row-geometry";

// -- Types ---------------------------------------------------------------------

type WordFit = "full" | "narrow" | "tick";

interface WordLabelFit {
  fit: WordFit;
  // The label still overflows at the narrow size, so it fades out instead of ending mid-letter.
  cut: boolean;
}

// -- Constants -----------------------------------------------------------------

const TICK_WIDTH_PX = 20;
const LABEL_PADDING_PX: Record<WordTrackType, number> = { word: 18, bg: 14 };
const NARROW_LABEL_PADDING_PX: Record<WordTrackType, number> = { word: 6, bg: 4 };
const LABEL_FONT: Record<WordTrackType, string> = { word: "500 13px", bg: "500 11.5px" };
const NARROW_LABEL_FONT: Record<WordTrackType, string> = { word: "500 11px", bg: "500 11.5px" };

let measureContext: CanvasRenderingContext2D | null | undefined;
let fontFamily: string | undefined;

// -- Functions -----------------------------------------------------------------

function labelWidth(text: string, font: string): number {
  if (measureContext === undefined) measureContext = document.createElement("canvas").getContext("2d");
  if (!measureContext) return 0;
  fontFamily ??= getComputedStyle(document.documentElement).getPropertyValue("--font-sans") || "sans-serif";
  measureContext.font = `${font} ${fontFamily}`;
  return measureContext.measureText(text).width;
}

// A label that does not fit drops to a smaller face; a block too thin for any text shows none.
function wordFit(text: string, width: number, track: WordTrackType): WordLabelFit {
  if (labelWidth(text, LABEL_FONT[track]) + LABEL_PADDING_PX[track] <= width) return { fit: "full", cut: false };
  if (width < TICK_WIDTH_PX) return { fit: "tick", cut: false };
  return { fit: "narrow", cut: labelWidth(text, NARROW_LABEL_FONT[track]) + NARROW_LABEL_PADDING_PX[track] > width };
}

// -- Exports -------------------------------------------------------------------

export { wordFit };
