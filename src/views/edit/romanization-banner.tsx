import { IconLanguage } from "@tabler/icons-react";
import { useMemo, useState } from "react";
import { detectNonLatinLanguage, linesEligibleForRomanization } from "@/domain/romanization/detect";
import { generateForLines } from "@/domain/romanization/generate";
import { availableSchemesForLang, defaultSchemeForLang } from "@/domain/romanization/schemes";
import type { LyricLine } from "@/domain/line/model";
import { useProjectStore } from "@/stores/project";
import { getRomanizationTurnstileSiteKey, useSettingsStore } from "@/stores/settings";
import { Button } from "@/ui/button";
import { toastBulkResult, toastError } from "@/utils/romanization/toast";

// -- Constants ----------------------------------------------------------------

const NO_SITE_KEY_TOOLTIP = "Set a Turnstile site key in Settings > Romanization";

// -- Helpers ------------------------------------------------------------------

function pickDominantLanguage(lines: readonly LyricLine[]): string | null {
  const counts = new Map<string, number>();
  for (const line of lines) {
    const lang = detectNonLatinLanguage(line.text);
    if (!lang) continue;
    counts.set(lang, (counts.get(lang) ?? 0) + 1);
  }
  let best: { lang: string; count: number } | null = null;
  for (const [lang, count] of counts) {
    if (!best || count > best.count) best = { lang, count };
  }
  return best?.lang ?? null;
}

function shouldShowBanner(eligible: readonly LyricLine[], scheme: string | undefined): boolean {
  if (eligible.length === 0) return false;
  if (!scheme) return true;
  return eligible.some((line) => !line.romanization?.text);
}

// -- Component ----------------------------------------------------------------

const RomanizationBanner: React.FC = () => {
  const lines = useProjectStore((s) => s.lines);
  const metadata = useProjectStore((s) => s.metadata);
  const siteKeyOverride = useSettingsStore((s) => s.romanizationTurnstileSiteKey);
  const [isGenerating, setIsGenerating] = useState(false);

  const eligible = useMemo(() => linesEligibleForRomanization(lines), [lines]);
  const detectedLang = useMemo(() => pickDominantLanguage(eligible), [eligible]);
  const fallbackScheme = detectedLang ? defaultSchemeForLang(detectedLang) : "";
  const initialScheme = metadata.romanizationScheme ?? fallbackScheme;
  const [scheme, setScheme] = useState(initialScheme);

  const visible = shouldShowBanner(eligible, metadata.romanizationScheme);
  const schemes = detectedLang ? availableSchemesForLang(detectedLang) : [];
  const siteKey = siteKeyOverride.trim() || getRomanizationTurnstileSiteKey();
  const siteKeyMissing = siteKey.length === 0;

  if (!visible || !detectedLang) return null;

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const summary = await generateForLines(scheme, eligible);
      useProjectStore.getState().setMetadata({ romanizationScheme: scheme });
      toastBulkResult(summary);
    } catch (err) {
      toastError(err);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div
      data-testid="romanization-banner"
      className="flex items-center justify-between gap-3 px-3 py-2 text-sm rounded-lg bg-composer-accent/10 text-composer-accent-text"
    >
      <div className="flex items-center gap-2">
        <IconLanguage className="size-4 shrink-0" />
        <span>Detected non-Latin lyrics ({detectedLang.toUpperCase()})</span>
      </div>
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-1.5 text-xs text-composer-text-secondary select-none">
          <span>Scheme</span>
          <select
            value={scheme}
            onChange={(event) => setScheme(event.target.value)}
            className="h-7 px-2 text-xs border rounded cursor-pointer bg-composer-input border-composer-border focus:outline-none focus:border-composer-accent"
          >
            {schemes.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <Button
          hasIcon
          variant="primary"
          size="sm"
          onClick={handleGenerate}
          disabled={isGenerating || siteKeyMissing}
          title={siteKeyMissing ? NO_SITE_KEY_TOOLTIP : undefined}
        >
          <IconLanguage className="size-3.5" />
          {isGenerating ? "Generating..." : "Generate romanization"}
        </Button>
      </div>
    </div>
  );
};

// -- Exports ------------------------------------------------------------------

export { RomanizationBanner };
