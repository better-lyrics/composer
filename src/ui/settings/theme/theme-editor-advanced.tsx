import { deriveTheme } from "@/domain/theme/derive";
import { type Theme, type TokenMeta, TOKENS, type TokenKey } from "@/domain/theme/model";
import { ThemeTokenInput } from "@/ui/settings/theme/theme-token-input";

// -- Interfaces ----------------------------------------------------------------

interface ThemeEditorAdvancedProps {
  draft: Theme;
  onTokenChange: (key: TokenKey, value: string) => void;
}

// -- Constants -----------------------------------------------------------------

const TOKENS_BY_GROUP = TOKENS.reduce((groups, token) => {
  const bucket = groups.get(token.group);
  if (bucket) bucket.push(token);
  else groups.set(token.group, [token]);
  return groups;
}, new Map<string, TokenMeta[]>());

const GROUP_ORDER: string[] = [...TOKENS_BY_GROUP.keys()];

const GROUP_LABEL = "font-mono text-[10px] tracking-wider text-composer-text-faint select-none";

const HINT = `Full control over all ${TOKENS.length} tokens, grouped. Derived values are pre-filled from your Quick choices; override any of them here.`;

// -- Components ----------------------------------------------------------------

const ThemeEditorAdvanced: React.FC<ThemeEditorAdvancedProps> = ({ draft, onTokenChange }) => {
  const resolved = deriveTheme(draft);

  return (
    <div className="flex flex-col gap-4">
      <p className="rounded-lg border border-composer-accent/20 bg-composer-accent/10 px-2.5 py-2 text-xs text-composer-text-muted select-none">
        {HINT}
      </p>
      {GROUP_ORDER.map((group) => (
        <div key={group} className="flex flex-col gap-1">
          <span className={GROUP_LABEL}>{group}</span>
          <div className="divide-y divide-composer-border">
            {(TOKENS_BY_GROUP.get(group) ?? []).map((token) => {
              if (token.type === "alpha" || token.type === "contrast") {
                return (
                  <div key={token.key} className="flex items-center gap-3 py-2 select-none">
                    <span className="flex flex-1 min-w-0 flex-col gap-0.5">
                      <span className="text-sm text-composer-text">{token.label}</span>
                      <span className="text-[10px] text-composer-text-faint">auto from base</span>
                    </span>
                    <span className="font-mono text-[10px] text-composer-text-muted cursor-text select-text">
                      {resolved[token.key]}
                    </span>
                  </div>
                );
              }
              return (
                <div key={token.key} className="py-2">
                  <ThemeTokenInput
                    tokenKey={token.key}
                    label={token.label}
                    value={draft.tokens[token.key] ?? resolved[token.key]}
                    onChange={(value) => onTokenChange(token.key, value)}
                  />
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

// -- Exports -------------------------------------------------------------------

export { ThemeEditorAdvanced };
