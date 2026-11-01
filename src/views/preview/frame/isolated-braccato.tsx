import type { Bounds } from "@/domain/word/bounds";
import { BraccatoRenderer } from "@/views/preview/braccato-renderer";
import { BraccatoFrame } from "@/views/preview/frame/braccato-frame";
import { previewFrameOrigin } from "@/views/preview/frame/preview-frame-protocol";
import { useState } from "react";

// -- Interfaces ----------------------------------------------------------------

interface IsolatedBraccatoProps {
  ttmlString: string;
  focusRange: Bounds | null;
}

// -- Component -----------------------------------------------------------------

// Runs the sidebar preview in a cross-site frame, which Chrome gives its own process and main thread.
const IsolatedBraccato: React.FC<IsolatedBraccatoProps> = ({ ttmlString, focusRange }) => {
  const [frameOrigin] = useState(() => previewFrameOrigin(window.location.origin));
  const [isFrameUnavailable, setIsFrameUnavailable] = useState(false);

  if (!frameOrigin || isFrameUnavailable) {
    return <BraccatoRenderer ttmlString={ttmlString} layout="sidebar" focusRange={focusRange} />;
  }
  return (
    <BraccatoFrame
      ttmlString={ttmlString}
      focusRange={focusRange}
      frameOrigin={frameOrigin}
      onUnavailable={() => setIsFrameUnavailable(true)}
    />
  );
};

// -- Exports -------------------------------------------------------------------

export { IsolatedBraccato };
