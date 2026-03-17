import "@braccato/core";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { generateTTML } from "@/utils/ttml";
import { Button } from "@/ui/button";
import { getLineTiming } from "@/views/timeline/utils";
import { IconPlayerPauseFilled, IconPlayerPlayFilled } from "@tabler/icons-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// -- Components ---------------------------------------------------------------

const EmptyState: React.FC<{ message: string; hint: string }> = ({ message, hint }) => (
  <div className="flex flex-col items-center justify-center flex-1 gap-2 text-center">
    <p className="text-lg text-composer-text-secondary">{message}</p>
    <p className="text-sm text-composer-text-muted">{hint}</p>
  </div>
);

const PreviewPanel: React.FC = () => {
  const lines = useProjectStore((s) => s.lines);
  const agents = useProjectStore((s) => s.agents);
  const metadata = useProjectStore((s) => s.metadata);
  const granularity = useProjectStore((s) => s.granularity);
  const duration = useAudioStore((s) => s.duration);
  const source = useAudioStore((s) => s.source);
  const isPlaying = useAudioStore((s) => s.isPlaying);
  const setIsPlaying = useAudioStore((s) => s.setIsPlaying);
  const braccatoRef = useRef<HTMLElement>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  const hasSyncedContent = useMemo(() => {
    return lines.some((line) => getLineTiming(line) !== null);
  }, [lines]);

  const ttmlString = useMemo(() => {
    if (!hasSyncedContent) return null;
    return generateTTML({ metadata, agents, lines, granularity, duration });
  }, [metadata, agents, lines, granularity, duration, hasSyncedContent]);

  useEffect(() => {
    if (!ttmlString) {
      setBlobUrl(null);
      return;
    }
    const blob = new Blob([ttmlString], { type: "application/ttml+xml" });
    const url = URL.createObjectURL(blob);
    setBlobUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [ttmlString]);

  const handleLineClick = useCallback((e: Event) => {
    const detail = (e as CustomEvent).detail;
    if (detail?.time != null) {
      useAudioStore.getState().seekTo(detail.time / 1000);
    }
  }, []);

  useEffect(() => {
    const el = braccatoRef.current;
    if (!el) return;
    el.addEventListener("braccato:line-click", handleLineClick);
    return () => el.removeEventListener("braccato:line-click", handleLineClick);
  }, [handleLineClick]);

  if (!source) {
    return (
      <div className="flex flex-col flex-1 p-4">
        <EmptyState message="No audio loaded" hint="Import audio in the Import tab first" />
      </div>
    );
  }

  if (lines.length === 0) {
    return (
      <div className="flex flex-col flex-1 p-4">
        <EmptyState message="No lyrics to preview" hint="Add lyrics in the Edit tab first" />
      </div>
    );
  }

  if (!hasSyncedContent) {
    return (
      <div className="flex flex-col flex-1 p-4">
        <EmptyState message="No synced content" hint="Sync lyrics in the Sync tab first" />
      </div>
    );
  }

  return (
    <div data-tour="preview-panel" className="flex flex-col flex-1 overflow-hidden select-none">
      <div className="flex items-center justify-between px-6 py-4 border-b border-composer-border">
        <h2 className="text-lg font-medium">Preview</h2>
        <Button variant="primary" hasIcon onClick={() => setIsPlaying(!isPlaying)}>
          {isPlaying ? <IconPlayerPauseFilled className="w-4 h-4" /> : <IconPlayerPlayFilled className="w-4 h-4" />}
          {isPlaying ? "Pause" : "Play"}
        </Button>
      </div>

      <braccato-lyrics
        ref={braccatoRef}
        source="#composer-audio"
        src={blobUrl ?? undefined}
        className="flex-1 mx-auto w-full max-w-3xl px-6"
        style={
          {
            "--braccato-font-family": "'Satoshi', sans-serif",
            "--braccato-font-size": "2.5rem",
            "--braccato-inactive-opacity": "0.2",
          } as React.CSSProperties
        }
      />
    </div>
  );
};

// -- Exports ------------------------------------------------------------------

export { PreviewPanel };
