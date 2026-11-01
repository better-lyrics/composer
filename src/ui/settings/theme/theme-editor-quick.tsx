import { deriveTheme } from "@/domain/theme/derive";
import { QUICK_TOKENS, type Theme, type TokenKey } from "@/domain/theme/model";
import { ThemeTokenInput } from "@/ui/settings/theme/theme-token-input";
import { IconInfoCircle } from "@tabler/icons-react";

// -- Interfaces ----------------------------------------------------------------

interface ThemeEditorQuickProps {
  draft: Theme;
  onTokenChange: (key: TokenKey, value: string) => void;
}

// -- Constants -----------------------------------------------------------------

const HINT =
  "Set a handful of core colors. Everything else (hover states, borders, muted text, accent shades) derives automatically from these plus the light/dark base.";

// -- Components ----------------------------------------------------------------

const QuickModeNote: React.FC = () => (
  <p className="flex gap-2 rounded-[10px] px-3 py-2.5 text-[12.5px] leading-[1.45] text-(--label) bg-composer-accent/8 shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--color-composer-accent)_22%,transparent)] select-none">
    <IconInfoCircle aria-hidden="true" className="size-[15px] shrink-0 mt-px text-composer-accent-text" />
    {HINT}
  </p>
);

const ThemeEditorQuick: React.FC<ThemeEditorQuickProps> = ({ draft, onTokenChange }) => {
  const resolved = deriveTheme(draft);

  return (
    <div className="divide-y divide-(--divider)">
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
  );
};

// -- Exports -------------------------------------------------------------------

export { QuickModeNote, ThemeEditorQuick };
