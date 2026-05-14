import "@braccato/core";
import { useAudioStore } from "@/stores/audio";
import { useCallback, useEffect, useRef, useState } from "react";

// -- Interfaces ---------------------------------------------------------------

interface BraccatoRendererProps {
  ttmlString: string;
}

// -- Component ----------------------------------------------------------------

const BraccatoRenderer: React.FC<BraccatoRendererProps> = ({ ttmlString }) => {
  const elementRef = useRef<HTMLElement>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  useEffect(() => {
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
    const el = elementRef.current;
    if (!el) return;
    el.addEventListener("braccato:line-click", handleLineClick);
    return () => el.removeEventListener("braccato:line-click", handleLineClick);
  }, [handleLineClick]);

  return (
    <braccato-lyrics
      ref={elementRef}
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
  );
};

// -- Exports ------------------------------------------------------------------

export { BraccatoRenderer };
