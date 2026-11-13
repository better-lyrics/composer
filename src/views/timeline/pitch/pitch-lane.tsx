import { effectiveBounds } from "@/domain/line/bounds";
import { effectiveTrackWords } from "@/domain/line/effective-words";
import { isLineTimed } from "@/domain/line/sync-progress";
import type { LyricLine } from "@/domain/line/model";
import { pitchRangeBetween } from "@/domain/pitch/line-range";
import { songWordCoverage, spillRuns, wordCoverage } from "@/domain/pitch/spill";
import type { PitchPoint } from "@/domain/pitch/track";
import type { Bounds } from "@/domain/word/bounds";
import type { Rgb } from "@/domain/spectrum/palettes";
import { useFrameLoop } from "@/hooks/use-frame-loop";
import { livePlaybackTime } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
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
import { useLiveWordEdit } from "@/views/timeline/pitch/live-word-edit";
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

interface LaneInks {
  colour: string;
  rows: PitchRows;
  ink: Rgb;
  lit: Rgb;
  warning: Rgb;
}

interface OtherTracksCoverage {
  lines: readonly LyricLine[];
  lineId: string;
  kind: PitchLaneKind;
  coverage: readonly Bounds[];
}

interface PitchLaneProps {
  line: LyricLine;
  kind: PitchLaneKind;
  height: number;
  color: string;
}

// -- Helpers -------------------------------------------------------------------

function selectedIds(
  selections: ReturnType<typeof useTimelineStore.getState>["selectedWords"],
  lineId: string,
  kind: PitchLaneKind,
): string {
  return selections
    .flatMap((selection) => (selection.lineId === lineId && selection.type === kind ? [selection.syllableId] : []))
    .join();
}

// The ribbon takes the singer's colour, lifted toward the ink so it reads on the word face in both schemes.
function singerInk(agentColour: string): Rgb {
  const light = document.documentElement.dataset.scheme === "light";
  return rgbOf(`color-mix(in oklab, ${agentColour} ${light ? 72 : 38}%, ${cssVariable("--color-composer-text")})`);
}

// What has been sung lights up in the singer's own colour, pushed away from the word face.
function singerLitInk(agentColour: string): Rgb {
  const light = document.documentElement.dataset.scheme === "light";
  return rgbOf(`color-mix(in oklab, ${agentColour} ${light ? 70 : 62}%, ${light ? "black" : "white"})`);
}

// Resolving a colour reads computed styles, so a lane resolves its inks again only when the singer or theme changes.
function laneInks(previous: LaneInks | null, colour: string, rows: PitchRows): LaneInks {
  if (previous && previous.colour === colour && previous.rows === rows) return previous;
  return {
    colour,
    rows,
    ink: singerInk(colour),
    lit: singerLitInk(colour),
    warning: rgbOf(cssVariable("--color-composer-warning")),
  };
}

// Only a word with pitch under it lifts its label to make room for the line.
function markPitchedWords(track: HTMLElement | null, runs: readonly PitchPoint[][]): void {
  if (!track) return;
  for (const block of track.querySelectorAll<HTMLElement>("[data-word-block]")) {
    const begin = Number(block.dataset.begin);
    const end = Number(block.dataset.end);
    const pitched = runs.some((run) => run.some((point) => point.seconds >= begin && point.seconds < end));
    block.toggleAttribute("data-pitched", pitched);
  }
}

// Every track but the edited one, built once per lines change, so a drag merges only its own words on each move.
function otherTracksCoverage(
  previous: OtherTracksCoverage | null,
  lines: readonly LyricLine[],
  lineId: string,
  kind: PitchLaneKind,
): OtherTracksCoverage {
  if (previous && previous.lines === lines && previous.lineId === lineId && previous.kind === kind) return previous;
  return { lines, lineId, kind, coverage: songWordCoverage(lines, { lineId, track: kind, words: [] }) };
}

// -- Components ----------------------------------------------------------------

const PitchLaneCanvas: React.FC<PitchLaneProps & { rows: PitchRows }> = ({ line, kind, height, color, rows }) => {
  const zoom = useTimelineStore((s) => s.zoom);
  const selected = useTimelineStore((s) => selectedIds(s.selectedWords, line.id, kind));
  const live = useLiveWordEdit(line.id, kind);
  const sparkRef = useRef<HTMLCanvasElement>(null);
  const sungRef = useRef<HTMLCanvasElement>(null);
  const ghostRef = useRef<HTMLCanvasElement>(null);
  const spillCountRef = useRef<number | null>(null);
  const sungClipRef = useRef<SungClip | null>(null);
  const inksRef = useRef<LaneInks | null>(null);
  const otherTracksRef = useRef<OtherTracksCoverage | null>(null);
  const pitchLineOn = useSettingsStore((s) => s.pitchLine !== "off");
  const hasSungLane = isLineTimed(line) && (effectiveTrackWords(line, kind)?.length ?? 0) > 0;

  const revealSung = useCallback(() => {
    const sung = sungRef.current;
    const clip = sungClipRef.current;
    if (!sung || !clip) return;
    const shown = Math.round(Math.min(clip.width, Math.max(0, livePlaybackTime() * clip.zoom - clip.left)));
    if (shown === clip.shown) return;
    clip.shown = shown;
    sung.style.clipPath = `inset(0 ${clip.width - shown}px 0 0)`;
  }, []);

  useFrameLoop(revealSung, "pitch-sung-fill", pitchLineOn && hasSungLane);

  useEffect(() => {
    const spark = sparkRef.current;
    const sung = sungRef.current;
    const ghost = ghostRef.current;
    const lineBounds = effectiveBounds(line);
    const words = effectiveTrackWords(line, kind) ?? [];
    if (!spark || !sung || !ghost || !lineBounds || words.length === 0) return;
    const selectedSet = new Set(selected.split(","));
    const laneWords: LaneWord[] = words.map((word, index) => {
      const { begin, end } = live?.words.get(index) ?? word;
      return {
        begin,
        end,
        tick: wordFit(word.text + word.sep, wordBlockWidth(begin, end, zoom)).fit === "tick",
        selected: selectedSet.has(word.id),
      };
    });
    const window = laneWindow(
      lineBounds,
      zoom,
      height,
      pitchRangeBetween(rows.track, lineBounds.begin, lineBounds.end),
    );
    const leadWords = kind === "bg" ? (effectiveTrackWords(line, "word") ?? []) : [];
    const drawing = { window, runs: laneRuns(rows.track, kind, window, laneWords, leadWords), words: laneWords };
    let coverage = rows.coverage;
    if (live) {
      const others = otherTracksCoverage(otherTracksRef.current, useProjectStore.getState().lines, line.id, kind);
      otherTracksRef.current = others;
      coverage = wordCoverage([...others.coverage, ...laneWords]);
    }
    const spills = kind === "word" ? spillRuns(drawing.runs, coverage) : [];
    if (spillCountRef.current !== null && spills.length < spillCountRef.current) {
      fadeOutSnapshot(spark, ghost, pitchLineMotion.spillFadeMs);
    }
    spillCountRef.current = spills.length;
    markPitchedWords(spark.parentElement, drawing.runs);
    const inks = laneInks(inksRef.current, color, rows);
    inksRef.current = inks;
    drawPitchLane(spark, drawing, spills, inks.ink, inks.warning);
    drawSungLane(sung, drawing, inks.lit);
    sungClipRef.current = { left: window.left, width: window.width, zoom, shown: -1 };
    revealSung();
  }, [rows, line, kind, zoom, height, color, selected, live, revealSung]);

  return (
    <>
      <canvas ref={ghostRef} aria-hidden className="pitch-lane-ghost" />
      <canvas ref={sparkRef} aria-hidden className="pitch-lane" />
      <canvas ref={sungRef} aria-hidden data-sung data-playback-style="clip-path" className="pitch-lane" />
    </>
  );
};

const PitchLane: React.FC<PitchLaneProps> = (props) => {
  const rows = usePitchRows();
  return rows ? <PitchLaneCanvas {...props} rows={rows} /> : null;
};

// -- Exports -------------------------------------------------------------------

export { PitchLane };
