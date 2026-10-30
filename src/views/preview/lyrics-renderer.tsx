import type { Bounds } from "@/domain/word/bounds";
import { useSettingsStore } from "@/stores/settings";
import { AmLyricsRenderer } from "@/views/preview/am-lyrics-renderer";
import { BraccatoRenderer } from "@/views/preview/braccato-renderer";
import { IsolatedBraccato } from "@/views/preview/frame/isolated-braccato";
import type { LyricsLayout } from "@/views/preview/lyrics-layout";

// -- Interfaces ---------------------------------------------------------------

interface LyricsRendererProps {
  ttmlString: string;
  durationSeconds: number;
  layout?: LyricsLayout;
  focusRange?: Bounds | null;
  // Moves Braccato's work off this document's main thread when a cross-site frame origin exists.
  isolated?: boolean;
}

// -- Component ----------------------------------------------------------------

const LyricsRenderer: React.FC<LyricsRendererProps> = ({
  ttmlString,
  durationSeconds,
  layout = "page",
  focusRange = null,
  isolated = false,
}) => {
  const renderer = useSettingsStore((s) => s.previewRenderer);

  if (renderer === "braccato" && isolated) return <IsolatedBraccato ttmlString={ttmlString} focusRange={focusRange} />;

  return renderer === "am-lyrics" ? (
    <AmLyricsRenderer
      ttmlString={ttmlString}
      durationSeconds={durationSeconds}
      layout={layout}
      focusRange={focusRange}
    />
  ) : (
    <BraccatoRenderer ttmlString={ttmlString} layout={layout} focusRange={focusRange} />
  );
};

// -- Exports ------------------------------------------------------------------

export { LyricsRenderer };
