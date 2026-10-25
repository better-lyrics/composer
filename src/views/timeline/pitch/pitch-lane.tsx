import { effectiveBounds } from "@/domain/line/bounds";
import { effectiveTrackWords } from "@/domain/line/effective-words";
import type { LyricLine } from "@/domain/line/model";
import { pitchRangeBetween } from "@/domain/pitch/line-range";
import { spillRuns } from "@/domain/pitch/spill";
import type { Rgb } from "@/domain/spectrum/palettes";
import { useFrameLoop } from "@/hooks/use-frame-loop";
import { livePlaybackTime } from "@/stores/audio";
import { pitchLineMotion } from "@/utils/animationVariants";
import { cssVariable, rgbOf } from "@/utils/theme/css-colour";
import {
  type LaneWord,
  type PitchLaneKind,
  drawPitchLane,
  drawSungLane,
  fadeOutSnapshot,
  laneRuns,
  laneWindow,
} from "@/views/timeline/pitch/draw-pitch-lane";
import { type PitchRows, usePitchRows } from "@/views/timeline/pitch/pitch-rows";
import { wordBlockWidth } from "@/views/timeline/row-geometry";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { wordFit } from "@/views/timeline/word-fit";
import { useCallback, useEffect, useRef } from "react";

// -- Types ---------------------------------------------------------------------

interface SungClip {
  left: number;
  width: number;
  zoom: number;
  shown: number;
}

interface PitchLaneProps {
  line: LyricLine;
  kind: PitchLaneKind;
  height: number;
  color: string;
}

// -- Helpers -------------------------------------------------------------------

function selectedIndices(
  selections: ReturnType<typeof useTimelineStore.getState>["selectedWords"],
  lineId: string,
  kind: PitchLaneKind,
): string {
  return selections
    .flatMap((selection) => (selection.lineId === lineId && selection.type === kind ? [selection.wordIndex] : []))
    .join();
}

// The ribbon takes the singer's colour, lifted toward the ink so it reads on the word face in both schemes.
function singerInk(agentColour: string): Rgb {
  const light = document.documentElement.dataset.scheme === "light";
  return rgbOf(`color-mix(in oklab, ${agentColour} ${light ? 72 : 38}%, ${cssVariable("--color-composer-text")})`);
}

// -- Components ----------------------------------------------------------------

const PitchLaneCanvas: React.FC<PitchLaneProps & { rows: PitchRows }> = ({ line, kind, height, color, rows }) => {
  const zoom = useTimelineStore((s) => s.zoom);
  const selected = useTimelineStore((s) => selectedIndices(s.selectedWords, line.id, kind));
  const sparkRef = useRef<HTMLCanvasElement>(null);
  const sungRef = useRef<HTMLCanvasElement>(null);
  const ghostRef = useRef<HTMLCanvasElement>(null);
  const spillCountRef = useRef<number | null>(null);
  const sungClipRef = useRef<SungClip | null>(null);

  const revealSung = useCallback(() => {
    const sung = sungRef.current;
    const clip = sungClipRef.current;
    if (!sung || !clip) return;
    const shown = Math.round(Math.min(clip.width, Math.max(0, livePlaybackTime() * clip.zoom - clip.left)));
    if (shown === clip.shown) return;
    clip.shown = shown;
    sung.style.clipPath = `inset(0 ${clip.width - shown}px 0 0)`;
  }, []);

  useFrameLoop(revealSung, "pitch-sung-fill");

  useEffect(() => {
    const spark = sparkRef.current;
    const sung = sungRef.current;
    const ghost = ghostRef.current;
    const lineBounds = effectiveBounds(line);
    const words = effectiveTrackWords(line, kind) ?? [];
    if (!spark || !sung || !ghost || !lineBounds || words.length === 0) return;
    const selectedSet = new Set(selected.split(",").filter(Boolean).map(Number));
    const laneWords: LaneWord[] = words.map((word, index) => ({
      begin: word.begin,
      end: word.end,
      tick: wordFit(word.text, wordBlockWidth(word.begin, word.end, zoom)).fit === "tick",
      selected: selectedSet.has(index),
    }));
    const window = laneWindow(
      lineBounds,
      zoom,
      height,
      pitchRangeBetween(rows.track, lineBounds.begin, lineBounds.end),
    );
    const leadWords = kind === "bg" ? (effectiveTrackWords(line, "word") ?? []) : [];
    const drawing = { window, runs: laneRuns(rows.track, kind, window, laneWords, leadWords), words: laneWords };
    const spills = kind === "word" ? spillRuns(drawing.runs, rows.coverage) : [];
    if (spillCountRef.current !== null && spills.length < spillCountRef.current) {
      fadeOutSnapshot(spark, ghost, pitchLineMotion.spillFadeMs);
    }
    spillCountRef.current = spills.length;
    drawPitchLane(spark, drawing, spills, singerInk(color), rgbOf(cssVariable("--color-composer-warning")));
    drawSungLane(sung, drawing, rgbOf(cssVariable("--color-composer-accent-text")));
    sungClipRef.current = { left: window.left, width: window.width, zoom, shown: -1 };
    revealSung();
  }, [rows, line, kind, zoom, height, color, selected, revealSung]);

  return (
    <>
      <canvas ref={ghostRef} aria-hidden className="pitch-lane-ghost" />
      <canvas ref={sparkRef} aria-hidden className="pitch-lane" />
      <canvas ref={sungRef} aria-hidden data-sung className="pitch-lane" />
    </>
  );
};

const PitchLane: React.FC<PitchLaneProps> = (props) => {
  const rows = usePitchRows();
  return rows ? <PitchLaneCanvas {...props} rows={rows} /> : null;
};

// -- Exports -------------------------------------------------------------------

export { PitchLane };
