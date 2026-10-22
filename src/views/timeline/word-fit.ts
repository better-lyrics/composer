import type { WordTrackType } from "@/views/timeline/row-geometry";

// -- Types ---------------------------------------------------------------------

type WordFit = "full" | "narrow" | "tick";

// -- Constants -----------------------------------------------------------------

const TICK_WIDTH_PX = 20;
const LABEL_PADDING_PX: Record<WordTrackType, number> = { word: 18, bg: 14 };
const LABEL_FONT: Record<WordTrackType, string> = { word: "500 13px", bg: "italic 500 11.5px" };

let measureContext: CanvasRenderingContext2D | null | undefined;
let fontFamily: string | undefined;

// -- Functions -----------------------------------------------------------------

function labelWidth(text: string, track: WordTrackType): number {
  if (measureContext === undefined) measureContext = document.createElement("canvas").getContext("2d");
  if (!measureContext) return 0;
  fontFamily ??= getComputedStyle(document.documentElement).getPropertyValue("--font-sans") || "sans-serif";
  measureContext.font = `${LABEL_FONT[track]} ${fontFamily}`;
  return measureContext.measureText(text).width;
}

// A label that does not fit drops to a smaller face; a block too thin for any text shows none.
function wordFit(text: string, width: number, track: WordTrackType): WordFit {
  if (labelWidth(text, track) + LABEL_PADDING_PX[track] <= width) return "full";
  return width >= TICK_WIDTH_PX ? "narrow" : "tick";
}

// -- Exports -------------------------------------------------------------------

export { wordFit };
