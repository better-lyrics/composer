import { useState } from "react";
import { encodeThemeCode } from "@/domain/theme/code";
import type { Theme } from "@/domain/theme/model";
import { Button } from "@/ui/button";
import { IconCheck, IconCopy } from "@tabler/icons-react";

// -- Interfaces ----------------------------------------------------------------

interface ThemeShareBoxProps {
  draft: Theme;
}

// -- Components ----------------------------------------------------------------

const ThemeShareBox: React.FC<ThemeShareBoxProps> = ({ draft }) => {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const code = encodeThemeCode(draft);

  const handleCopy = async () => {
    try {
      await navigator.clipboard?.writeText(code);
      setError(null);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Clipboard unavailable");
    }
  };

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-medium text-composer-text select-none">Share this theme</span>
        <span className="text-xs text-composer-text-muted select-none">
          Copy this code to share your theme, or paste one into Import code to load someone else's.
        </span>
      </div>
      <textarea
        readOnly
        value={code}
        aria-label="Theme share code"
        spellCheck={false}
        className="w-full min-h-16 resize-y rounded-lg border border-composer-border bg-composer-bg-dark px-3 py-2.5 font-mono text-xs leading-relaxed text-composer-text outline-none break-all cursor-text select-text"
      />
      <div className="flex items-center gap-2">
        <Button size="sm" variant="secondary" hasIcon onClick={handleCopy}>
          {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
          {copied ? "Copied" : "Copy code"}
        </Button>
        {error && (
          <span role="alert" className="text-xs text-composer-error select-text cursor-text">
            {error}
          </span>
        )}
      </div>
    </div>
  );
};

// -- Exports -------------------------------------------------------------------

export { ThemeShareBox };
