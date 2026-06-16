import { deriveTheme } from "@/domain/theme/derive";
import { QUICK_TOKENS, type Theme, type TokenKey } from "@/domain/theme/model";
import { ThemeTokenInput } from "@/ui/settings/theme/theme-token-input";

// -- Interfaces ----------------------------------------------------------------

interface ThemeEditorQuickProps {
  draft: Theme;
  onTokenChange: (key: TokenKey, value: string) => void;
}

// -- Constants -----------------------------------------------------------------

const HINT =
  "Set a handful of core colors. Everything else (hover states, borders, muted text, accent shades) derives automatically from these plus the light/dark base.";

// -- Components ----------------------------------------------------------------

const ThemeEditorQuick: React.FC<ThemeEditorQuickProps> = ({ draft, onTokenChange }) => {
  const resolved = deriveTheme(draft);

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
    </div>
  );
};

// -- Exports -------------------------------------------------------------------

export { ThemeEditorQuick };
