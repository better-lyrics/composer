import { cn } from "@/utils/cn";
import { type LyricFormat, type Token, tokenize } from "@braccato/highlight";
import { useMemo } from "react";

// -- Interfaces ---------------------------------------------------------------

interface LyricsCodeProps {
  code: string;
  format?: LyricFormat;
  className?: string;
}

// -- Helpers ------------------------------------------------------------------

// The package renderers draw adjacent tokens of one type as a single span; tokenize leaves them apart.
function mergedTokens(tokens: readonly Token[]): Token[] {
  const merged: Token[] = [];
  for (const token of tokens) {
    const last = merged[merged.length - 1];
    if (last?.type === token.type) merged[merged.length - 1] = { type: last.type, text: last.text + token.text };
    else merged.push(token);
  }
  return merged;
}

// -- Components ---------------------------------------------------------------

const LyricsCode: React.FC<LyricsCodeProps> = ({ code, format, className }) => {
  const tokens = useMemo(() => mergedTokens(tokenize(code, format)), [code, format]);

  return (
    <pre className={cn("bh", className)}>
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
