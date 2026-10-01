import { LyricsCode } from "@/ui/lyrics-code/lyrics-code";
import type { LyricFormat } from "@braccato/highlight";

// -- Interfaces ---------------------------------------------------------------

interface GuideCodeProps {
  code: string;
  format?: LyricFormat;
}

// -- Constants ----------------------------------------------------------------

const GUIDE_CODE_CLASS =
  "bg-composer-bg-dark border border-composer-border rounded-lg p-4 overflow-x-auto text-xs font-mono text-composer-text";

// -- Components ---------------------------------------------------------------

const GuideCode: React.FC<GuideCodeProps> = ({ code, format }) => (
  <LyricsCode code={code} format={format} className={GUIDE_CODE_CLASS} />
);

// -- Exports ------------------------------------------------------------------

export { GuideCode };
