import { useSettingsStore } from "@/stores/settings";
import { AmLyricsRenderer } from "@/views/preview/am-lyrics-renderer";
import { BraccatoRenderer } from "@/views/preview/braccato-renderer";
import type { LyricsLayout } from "@/views/preview/lyrics-layout";

// -- Interfaces ---------------------------------------------------------------

interface LyricsRendererProps {
  ttmlString: string;
  durationSeconds: number;
  layout?: LyricsLayout;
}

// -- Component ----------------------------------------------------------------

const LyricsRenderer: React.FC<LyricsRendererProps> = ({ ttmlString, durationSeconds, layout = "page" }) => {
  const renderer = useSettingsStore((s) => s.previewRenderer);

  return renderer === "am-lyrics" ? (
    <AmLyricsRenderer ttmlString={ttmlString} durationSeconds={durationSeconds} layout={layout} />
  ) : (
    <BraccatoRenderer ttmlString={ttmlString} layout={layout} />
  );
};

// -- Exports ------------------------------------------------------------------

export { LyricsRenderer };
