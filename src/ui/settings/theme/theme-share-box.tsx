import { encodeThemeCode } from "@/domain/theme/code";
import type { Theme } from "@/domain/theme/model";
import { Button } from "@/ui/button";
import { IconCheck, IconCopy } from "@tabler/icons-react";
import { useState } from "react";

// -- Interfaces ----------------------------------------------------------------

interface ThemeShareBoxProps {
  draft: Theme;
}

// -- Components ----------------------------------------------------------------

const ThemeShareBox: React.FC<ThemeShareBoxProps> = ({ draft }) => (
  <div className="flex flex-col gap-2.5">
    <div className="flex flex-col gap-[3px]">
      <span className="text-sm font-medium text-composer-text select-none">Share this theme</span>
      <span className="text-[12.5px] leading-[1.45] text-(--muted) select-none">
        Copy this code to share your theme, or paste one into Import code to load someone else's.
      </span>
    </div>
    <textarea
      readOnly
      value={encodeThemeCode(draft)}
      aria-label="Theme share code"
      spellCheck={false}
      className="w-full min-h-16 resize-y rounded-[10px] border border-(--edge) bg-(--well) px-2.5 py-2 font-mono text-xs leading-relaxed text-composer-text outline-none break-all cursor-text select-text"
    />
  </div>
);

const CopyThemeCodeButton: React.FC<ThemeShareBoxProps> = ({ draft }) => {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCopy = async () => {
    try {
      await navigator.clipboard?.writeText(encodeThemeCode(draft));
      setError(null);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Clipboard unavailable");
    }
  };

  return (
    <>
      <Button size="lg" variant="secondary" hasIcon onClick={handleCopy}>
        {copied ? <IconCheck className="size-4" /> : <IconCopy className="size-4" />}
        {copied ? "Copied" : "Copy code"}
      </Button>
      {error && (
        <span role="alert" className="text-xs text-composer-error select-text cursor-text">
          {error}
        </span>
      )}
    </>
  );
};

// -- Exports -------------------------------------------------------------------

export { CopyThemeCodeButton, ThemeShareBox };
