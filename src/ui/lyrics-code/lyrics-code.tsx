import { cn } from "@/utils/cn";
import { type LyricFormat, tokenize } from "@braccato/highlight";
import { useMemo } from "react";

// -- Interfaces ---------------------------------------------------------------

interface LyricsCodeProps {
  code: string;
  format?: LyricFormat;
  className?: string;
}

// -- Components ---------------------------------------------------------------

const LyricsCode: React.FC<LyricsCodeProps> = ({ code, format, className }) => {
  const tokens = useMemo(() => tokenize(code, format), [code, format]);

  return (
    <pre className={cn("bh lyrics-code-surface", className)}>
      {tokens.map((token, index) =>
        token.type === "text" ? (
          token.text
        ) : (
          <span key={`${index}-${token.type}`} className={`bh-${token.type}`}>
            {token.text}
          </span>
        ),
      )}
    </pre>
  );
};

// -- Exports ------------------------------------------------------------------

export { LyricsCode };
