import type { Script } from "@/domain/romanization/detect";
import { getSchemeByScript, SCHEMES } from "@/domain/romanization/schemes";
import { Button } from "@/ui/button";
import { IconLanguage, IconX } from "@tabler/icons-react";
import { useMemo, useState } from "react";

// -- Interfaces ---------------------------------------------------------------

interface RomanizationBannerProgress {
  done: number;
  total: number;
}

interface RomanizationBannerProps {
  detectedScript: Script;
  detectedLineCount: number;
  onPick: (scheme: string) => void;
  onDismiss: () => void;
  progress?: RomanizationBannerProgress;
}

// -- Constants ----------------------------------------------------------------

const SCRIPT_LABELS: Record<Script, string> = {
  latin: "Latin",
  japanese: "Japanese",
  chinese: "Chinese",
  korean: "Korean",
  russian: "Russian",
  greek: "Greek",
  thai: "Thai",
  arabic: "Arabic",
  hindi: "Hindi",
  bengali: "Bengali",
  hebrew: "Hebrew",
};

// -- Component ----------------------------------------------------------------

const RomanizationBanner: React.FC<RomanizationBannerProps> = ({
  detectedScript,
  detectedLineCount,
  onPick,
  onDismiss,
  progress,
}) => {
  const defaultScheme = getSchemeByScript(detectedScript);
  const [scheme, setScheme] = useState<string | undefined>(defaultScheme);

  const eligibleSchemes = useMemo(() => SCHEMES.filter((entry) => entry.script === detectedScript), [detectedScript]);

  if (detectedScript === "latin" || detectedLineCount === 0) return null;
  if (eligibleSchemes.length === 0) return null;

  const scriptLabel = SCRIPT_LABELS[detectedScript];
  const lineLabel = `${detectedLineCount} line${detectedLineCount === 1 ? "" : "s"}`;
  const isGenerating = progress !== undefined;
  const progressPercent = isGenerating && progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;
  const activeScheme = scheme ?? eligibleSchemes[0].id;

  return (
    <section
      aria-label="Romanization suggestion"
      className="flex items-center gap-3 px-3 py-2 text-sm rounded-lg bg-composer-accent/10 text-composer-accent-text"
    >
      <IconLanguage className="size-4 shrink-0" aria-hidden />
      <span className="flex-1 select-none">
        {scriptLabel} script detected on {lineLabel}. Add romanization?
      </span>

      <label className="flex items-center gap-1.5 select-none">
        <span className="sr-only">Romanization scheme</span>
        <select
          aria-label="Romanization scheme"
          value={activeScheme}
          onChange={(e) => setScheme(e.target.value)}
          disabled={isGenerating}
          className="h-7 px-2 text-xs border rounded cursor-pointer bg-composer-input border-composer-border text-composer-text focus:outline-none focus:border-composer-accent disabled:cursor-not-allowed disabled:opacity-50"
        >
          {eligibleSchemes.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.label}
            </option>
          ))}
        </select>
      </label>

      <Button
        size="sm"
        variant="primary"
        onClick={() => onPick(activeScheme)}
        disabled={isGenerating}
        className="text-white"
      >
        {isGenerating ? `Generating ${progressPercent}%` : "Generate all"}
      </Button>

      <Button
        size="icon"
        variant="ghost"
        aria-label="Dismiss romanization suggestion"
        onClick={onDismiss}
        className="size-6"
      >
        <IconX className="size-4" />
      </Button>
    </section>
  );
};

// -- Exports ------------------------------------------------------------------

export { RomanizationBanner };
export type { RomanizationBannerProgress, RomanizationBannerProps };
