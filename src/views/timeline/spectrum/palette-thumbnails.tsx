import { rowBinTable } from "@/domain/spectrum/frequency-scale";
import type { SpectrumPalette } from "@/domain/spectrum/settings";
import { TILE_WIDTH } from "@/domain/spectrum/tile-key";
import { livePlaybackTime } from "@/stores/audio";
import { useSettingsStore } from "@/stores/settings";
import { useThemeStore } from "@/stores/theme";
import { SPECTRUM_PALETTE_OPTIONS } from "@/ui/spectrum-options";
import { cn } from "@/utils/cn";
import { renderTile } from "@/views/timeline/spectrum/render-tile";
import { spectrumSession, useSpectrumStatus } from "@/views/timeline/spectrum/spectrum-session";
import { resolveSpectrumPalette } from "@/views/timeline/spectrum/theme-palette";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { useEffect, useRef } from "react";

// -- Constants -----------------------------------------------------------------

const THUMB_HEIGHT = 40;

// -- Helpers -------------------------------------------------------------------

// Each colour choice previews this song: the tile under the playhead, painted in that palette.
function paintThumbnail(canvas: HTMLCanvasElement, palette: SpectrumPalette): void {
  const context = canvas.getContext("2d");
  if (!context) return;
  context.fillStyle = "#000";
  context.fillRect(0, 0, canvas.width, canvas.height);
  const session = spectrumSession;
  if (!session.magnitude || session.frames === 0) return;
  const settings = useSettingsStore.getState();
  const zoom = useTimelineStore.getState().zoom;
  const index = Math.max(0, Math.floor((livePlaybackTime() * zoom) / TILE_WIDTH));
  const tile = renderTile({
    session,
    table: rowBinTable(settings.spectrumScale, settings.spectrumTop, THUMB_HEIGHT, session.fftSize, session.sampleRate),
    lookup: resolveSpectrumPalette(palette).lookup,
    palette,
    phase: settings.spectrumPhase,
    contrastDb: settings.spectrumContrast,
    pixelsPerSecond: zoom,
    pixelRatio: 1,
    heightPx: THUMB_HEIGHT,
    index,
  });
  context.drawImage(tile.canvas, 0, 0, canvas.width, canvas.height);
}

// -- Components ----------------------------------------------------------------

const PaletteThumbnail: React.FC<{ palette: SpectrumPalette; label: string; selected: boolean }> = ({
  palette,
  label,
  selected,
}) => {
  const { percent, status } = useSpectrumStatus();
  const scale = useSettingsStore((s) => s.spectrumScale);
  const top = useSettingsStore((s) => s.spectrumTop);
  const contrast = useSettingsStore((s) => s.spectrumContrast);
  const themeId = useThemeStore((s) => s.activeThemeId);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const look = `${palette}|${percent}|${status}|${scale}|${top}|${contrast}|${themeId}`;
  useEffect(() => {
    if (canvasRef.current && look) paintThumbnail(canvasRef.current, palette);
  }, [look, palette]);
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={() => useSettingsStore.getState().set("spectrumPalette", palette)}
      className={cn(
        "grid gap-[7px] p-1.5 pb-2 rounded-xl text-left text-[12.5px] font-semibold cursor-pointer select-none",
        "transition-[background-color,box-shadow,scale] duration-150 ease-out active:scale-[0.96]",
        selected
          ? "text-composer-text bg-[color-mix(in_oklab,var(--color-composer-accent)_10%,var(--layer-1))] shadow-[inset_0_0_0_1.5px_var(--color-composer-accent),0_0_0_3px_var(--lit-ring)]"
          : "text-(--label) bg-(--layer-1) shadow-[inset_0_0_0_1px_var(--edge)] hover:bg-(--layer-2)",
      )}
    >
      <canvas
        ref={canvasRef}
        width={TILE_WIDTH}
        height={THUMB_HEIGHT}
        className="block w-full h-10 rounded-md bg-black outline outline-white/10 -outline-offset-1"
      />
      <span className="pl-0.5">{label}</span>
    </button>
  );
};

const PaletteThumbnails: React.FC<{ labelledBy: string }> = ({ labelledBy }) => {
  const palette = useSettingsStore((s) => s.spectrumPalette);
  return (
    <div role="group" aria-labelledby={labelledBy} className="grid grid-cols-3 gap-2">
      {SPECTRUM_PALETTE_OPTIONS.map((option) => (
        <PaletteThumbnail
          key={option.value}
          palette={option.value}
          label={option.label}
          selected={palette === option.value}
        />
      ))}
    </div>
  );
};

// -- Exports -------------------------------------------------------------------

export { PaletteThumbnails };
