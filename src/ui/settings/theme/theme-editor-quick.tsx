import { contrastRatio } from "@/domain/theme/color";
import { deriveTheme } from "@/domain/theme/derive";
import { QUICK_TOKENS, type Theme, type TokenKey } from "@/domain/theme/model";
import { ThemeTokenInput } from "@/ui/settings/theme/theme-token-input";
import { IconAlertTriangle } from "@tabler/icons-react";

// -- Interfaces ----------------------------------------------------------------

interface ThemeEditorQuickProps {
  draft: Theme;
  onTokenChange: (key: TokenKey, value: string) => void;
}

// -- Constants -----------------------------------------------------------------

const MIN_AA_CONTRAST = 4.5;

const HINT =
  "Set a handful of core colors. Everything else (hover states, borders, muted text, accent shades) derives automatically from these plus the light/dark base.";

// -- Components ----------------------------------------------------------------

const ThemeEditorQuick: React.FC<ThemeEditorQuickProps> = ({ draft, onTokenChange }) => {
  const resolved = deriveTheme(draft);
  const ratio = contrastRatio(resolved.text, resolved.bg);
  const lowContrast = ratio < MIN_AA_CONTRAST;

  return (
    <div className="flex flex-col gap-4">
      <p className="rounded-lg border border-composer-accent/20 bg-composer-accent/10 px-2.5 py-2 text-xs text-composer-text-muted select-none">
        {HINT}
      </p>
      <div className="divide-y divide-composer-border">
        {QUICK_TOKENS.map((token) => (
          <div key={token.key} className="py-2">
            <ThemeTokenInput
              tokenKey={token.key}
              label={token.quick ?? token.label}
              value={draft.tokens[token.key] ?? resolved[token.key]}
              onChange={(value) => onTokenChange(token.key, value)}
            />
          </div>
        ))}
      </div>
      {lowContrast && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-lg border border-composer-warning/20 bg-composer-warning/10 px-2.5 py-2 text-xs text-composer-warning select-text cursor-text"
        >
          <IconAlertTriangle size={14} className="shrink-0" />
          <span>{`Text on background is ${ratio.toFixed(1)}:1, below WCAG AA (4.5:1)`}</span>
        </div>
      )}
    </div>
  );
};

// -- Exports -------------------------------------------------------------------

export { ThemeEditorQuick };
