import { rowOfFrequency } from "@/domain/spectrum/frequency-scale";
import type { FrequencyScale, SpectrumTop } from "@/domain/spectrum/settings";
import { useSettingsStore } from "@/stores/settings";
import { useThemeStore } from "@/stores/theme";
import { useEffect, useRef } from "react";

// -- Interfaces ----------------------------------------------------------------

interface FrequencyAxisProps {
  height: number;
  reserveTop: number;
}

interface AxisLayout {
  height: number;
  reserveTop: number;
  scale: FrequencyScale;
  top: SpectrumTop;
}

// -- Constants -----------------------------------------------------------------

const AXIS_WIDTH = 48;
const FULL_TICKS = [100, 200, 500, 1000, 2000, 4000, 8000, 16000];
const VOICE_TICKS = [100, 200, 500, 1000, 2000, 4000, 8000];
const TICK_X = 41;
const TICK_LENGTH = 5;
const LABEL_RIGHT = 37;
const EDGE_MARGIN = 7;
const LABEL_ALPHA = 0.85;
const AXIS_FONT = `500 9.5px "Geist Mono", ui-monospace, monospace`;

// -- Helpers -------------------------------------------------------------------

function tickLabel(hz: number): string {
  return hz >= 1000 ? `${hz / 1000}k` : `${hz}`;
}

function paintAxis(canvas: HTMLCanvasElement, layout: AxisLayout): void {
  const pixelRatio = window.devicePixelRatio || 1;
  canvas.width = Math.round(AXIS_WIDTH * pixelRatio);
  canvas.height = Math.round(layout.height * pixelRatio);
  canvas.style.width = `${AXIS_WIDTH}px`;
  canvas.style.height = `${layout.height}px`;
  const context = canvas.getContext("2d");
  if (!context) return;
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  const styles = getComputedStyle(document.documentElement);
  const faint = styles.getPropertyValue("--color-composer-text-faint").trim();
  const label = styles.getPropertyValue("--color-composer-text-tertiary").trim();
  context.font = AXIS_FONT;
  context.textAlign = "right";
  context.textBaseline = "middle";
  const minimumGap = layout.height - layout.reserveTop < 80 ? 16 : 13;
  let lastY = Number.NEGATIVE_INFINITY;
  for (const hz of layout.top === "full" ? FULL_TICKS : VOICE_TICKS) {
    const y = Math.round(rowOfFrequency(layout.scale, layout.top, hz, layout.height));
    if (y < layout.reserveTop + EDGE_MARGIN || y > layout.height - EDGE_MARGIN || Math.abs(y - lastY) < minimumGap)
      continue;
    lastY = y;
    context.fillStyle = faint;
    context.fillRect(TICK_X, y, TICK_LENGTH, 1);
    context.fillStyle = label;
    context.globalAlpha = LABEL_ALPHA;
    context.fillText(tickLabel(hz), LABEL_RIGHT, y + 0.5);
    context.globalAlpha = 1;
  }
}

// -- Components ----------------------------------------------------------------

const FrequencyAxis: React.FC<FrequencyAxisProps> = ({ height, reserveTop }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scale = useSettingsStore((s) => s.spectrumScale);
  const top = useSettingsStore((s) => s.spectrumTop);
  const themeId = useThemeStore((s) => s.activeThemeId);
  const customThemes = useThemeStore((s) => s.customThemes);

  // biome-ignore lint/correctness/useExhaustiveDependencies: the theme repaints the labels with the new colours
  useEffect(() => {
    if (canvasRef.current) paintAxis(canvasRef.current, { height, reserveTop, scale, top });
  }, [height, reserveTop, scale, top, themeId, customThemes]);

  return <canvas ref={canvasRef} className="absolute top-0 left-0 pointer-events-none" />;
};

// -- Exports -------------------------------------------------------------------

export { FrequencyAxis };
