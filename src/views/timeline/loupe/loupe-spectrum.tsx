import { getAgentColor } from "@/domain/agent/colors";
import { effectiveBounds } from "@/domain/line/bounds";
import { effectiveTrackWords, getEffectiveLines } from "@/domain/line/effective-words";
import type { LyricLine } from "@/domain/line/model";
import type { PitchTrack } from "@/domain/pitch/track";
import { type LoupeSize, clampLoupeSize } from "@/domain/spectrum/loupe-size";
import { type SpectrumLook, spectrumLookOf } from "@/domain/spectrum/settings";
import { TILE_WIDTH } from "@/domain/spectrum/tile-key";
import type { BeatGrid } from "@/domain/tempo/beat-grid";
import type { GridLines } from "@/domain/tempo/grid-points";
import type { WordTiming } from "@/domain/word/timing";
import { useFrameLoop } from "@/hooks/use-frame-loop";
import { animateFrames } from "@/lib/frame-loop";
import { livePlaybackTime } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { useThemeStore } from "@/stores/theme";
import {
  LOUPE_ZOOM,
  type LoupeCanvas,
  type LoupeFrame,
  drawLoupeBeats,
  drawLoupeEdge,
  drawLoupePitch,
  drawLoupePlayhead,
  drawLoupeRuler,
  loupeCanvas,
} from "@/views/timeline/loupe/draw-loupe";
import { drawLoupeLanes } from "@/views/timeline/loupe/draw-loupe-lanes";
import type { LoupeTarget } from "@/views/timeline/loupe/loupe-target";
import { pitchSession } from "@/views/timeline/pitch/pitch-session";
import { sizeCanvas } from "@/views/timeline/size-canvas";
import { spectrumSession } from "@/views/timeline/spectrum/spectrum-session";
import { resolveSpectrumPalette } from "@/views/timeline/spectrum/theme-palette";
import { drawTiles } from "@/views/timeline/spectrum/tile-cache";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { useEffect, useRef } from "react";

// -- Types --------------------------------------------------------------------

interface LoupeSpectrumProps {
  target: LoupeTarget;
  size?: LoupeSize;
}

interface DrawInputs extends SpectrumLook {
  target: LoupeTarget;
  zoom: number;
  playhead: number;
  pixelRatio: number;
  generation: number;
  readyChunks: number;
  themeId: string;
  customThemes: unknown;
  line: LyricLine | undefined;
  beatGrid: BeatGrid | null;
  beatGridVisible: boolean;
  beatGridLines: GridLines;
  pitchTrack: PitchTrack | null;
  loupeWidth: number;
  loupeHeight: number;
}

// -- Helpers ------------------------------------------------------------------

function sameInputs(previous: DrawInputs | null, next: DrawInputs): boolean {
  return previous !== null && (Object.keys(next) as (keyof DrawInputs)[]).every((key) => previous[key] === next[key]);
}

// The store has not seen a drag yet, so the edited edge takes the live time.
function withLiveEdge(words: readonly WordTiming[], target: LoupeTarget, track: "word" | "bg"): readonly WordTiming[] {
  if (target.track !== track || !words[target.wordIndex]) return words;
  return words.map((word, index) => (index === target.wordIndex ? { ...word, [target.edge]: target.time } : word));
}

function drawLoupe(
  context: CanvasRenderingContext2D,
  canvas: LoupeCanvas,
  target: LoupeTarget,
  inputs: DrawInputs,
): boolean {
  const pixelsPerSecond = inputs.zoom * LOUPE_ZOOM;
  const frame: LoupeFrame = {
    context,
    canvas,
    styles: getComputedStyle(document.documentElement),
    originX: target.time * pixelsPerSecond - canvas.width / 2,
    pixelsPerSecond,
  };
  const look = spectrumLookOf(inputs);
  const palette = resolveSpectrumPalette(look.spectrumPalette);
  context.clearRect(0, 0, canvas.width, canvas.height);
  let settled = true;
  if (spectrumSession.magnitude) {
    const view = {
      session: spectrumSession,
      look,
      lookup: palette.lookup,
      themeGeneration: palette.themeGeneration,
      pixelsPerSecond,
      pixelRatio: inputs.pixelRatio,
      heightCss: canvas.spectrumHeight,
      scrollLeft: frame.originX,
      viewportWidth: canvas.width,
    };
    settled = drawTiles(context, view, (tileContext, tile, _index, x) => {
      tileContext.drawImage(tile, x, 0, TILE_WIDTH, canvas.spectrumHeight);
      return false;
    }).settled;
  }
  context.globalCompositeOperation = "destination-over";
  context.fillStyle = "#000000";
  context.fillRect(0, 0, canvas.width, canvas.spectrumHeight);
  context.globalCompositeOperation = "source-over";

  drawLoupeRuler(frame);
  if (inputs.beatGrid && inputs.beatGridVisible) drawLoupeBeats(frame, inputs.beatGrid, inputs.beatGridLines);
  const { line } = inputs;
  if (line) {
    const [effective] = getEffectiveLines([line]);
    const span = effectiveBounds(effective);
    if (inputs.pitchTrack && span) drawLoupePitch(frame, inputs.pitchTrack, span);
    drawLoupeLanes(frame, {
      main: withLiveEdge(effectiveTrackWords(effective, "word") ?? [], target, "word"),
      background: withLiveEdge(effectiveTrackWords(effective, "bg") ?? [], target, "bg"),
      edited: { track: target.track, wordIndex: target.wordIndex },
      agentColour: getAgentColor(line.agentId),
      playheadSeconds: inputs.playhead,
    });
  }
  drawLoupePlayhead(frame, inputs.playhead);
  drawLoupeEdge(frame, target.time);
  return settled;
}

// -- Component ----------------------------------------------------------------

const LoupeSpectrum: React.FC<LoupeSpectrumProps> = ({ target, size }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawnRef = useRef<DrawInputs | null>(null);
  const releaseRef = useRef<(() => void) | null>(null);

  useEffect(
    () => () => {
      releaseRef.current?.();
      releaseRef.current = null;
    },
    [],
  );

  useFrameLoop(() => {
    const element = canvasRef.current;
    if (!element) return;
    const settings = useSettingsStore.getState();
    const theme = useThemeStore.getState();
    const project = useProjectStore.getState();
    const inputs: DrawInputs = {
      target,
      zoom: useTimelineStore.getState().zoom,
      playhead: livePlaybackTime(),
      pixelRatio: window.devicePixelRatio || 1,
      generation: spectrumSession.generation,
      readyChunks: spectrumSession.readyChunks,
      ...spectrumLookOf(settings),
      themeId: theme.activeThemeId,
      customThemes: theme.customThemes,
      line: project.lines.find((candidate) => candidate.id === target.lineId),
      beatGrid: project.beatGrid,
      beatGridVisible: settings.beatGridVisible,
      beatGridLines: settings.beatGridLines,
      pitchTrack: pitchSession.track,
      loupeWidth: size?.width ?? settings.loupeWidth,
      loupeHeight: size?.height ?? settings.loupeHeight,
    };
    if (sameInputs(drawnRef.current, inputs)) return;
    const { pixelRatio } = inputs;
    const canvas = loupeCanvas(clampLoupeSize({ width: inputs.loupeWidth, height: inputs.loupeHeight }));
    sizeCanvas(element, canvas.width, canvas.height, pixelRatio);
    const context = element.getContext("2d");
    if (!context) return;
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    const settled = drawLoupe(context, canvas, target, inputs);
    drawnRef.current = settled ? inputs : null;
    if (settled) {
      releaseRef.current?.();
      releaseRef.current = null;
    } else {
      releaseRef.current ??= animateFrames("loupe tiles");
    }
  }, "edit loupe");

  return <canvas ref={canvasRef} className="block rounded-[10px]" />;
};

// -- Exports ------------------------------------------------------------------

export { LoupeSpectrum };
