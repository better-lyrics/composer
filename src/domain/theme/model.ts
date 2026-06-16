// -- Theme token model ---------------------------------------------------------
// Single source of truth for the 31 --color-composer-* tokens, their derivation
// type, and the metadata the editor + deriver read. Mirrors src/index.css @theme.

type Scheme = "dark" | "light";

type TokenKey =
  | "bg"
  | "bg-dark"
  | "bg-elevated"
  | "overlay"
  | "overlay-hover"
  | "text"
  | "text-secondary"
  | "text-muted"
  | "text-disabled"
  | "text-tertiary"
  | "text-faint"
  | "button"
  | "button-hover"
  | "input"
  | "border"
  | "border-hover"
  | "accent"
  | "accent-dark"
  | "accent-darker"
  | "accent-text"
  | "on-accent"
  | "accent-warm"
  | "link"
  | "error"
  | "error-text"
  | "warning"
  | "explicit"
  | "wave"
  | "wave-progress"
  | "snap"
  | "onset";

type ThemeId = string;

interface Theme {
  id: ThemeId;
  name: string;
  kind: "preset" | "custom";
  group?: string;
  desc?: string;
  base?: ThemeId;
  scheme: Scheme;
  tokens: Partial<Record<TokenKey, string>>;
}

type ResolvedTheme = Record<TokenKey, string>;

type TokenType = "seed" | "alpha" | "shade" | "contrast";

interface TokenMeta {
  key: TokenKey;
  varName: string;
  label: string;
  group: string;
  type: TokenType;
  quick?: string;
  alpha?: number;
  on?: "fg" | "shadow";
  from?: TokenKey;
  lighten?: number;
}

// Order matters: accent precedes its shades + wave-progress so they resolve
// after their base. The deriver walks this array top to bottom.
const TOKENS: TokenMeta[] = [
  {
    key: "bg",
    varName: "--color-composer-bg",
    label: "Background",
    group: "Backgrounds",
    type: "seed",
    quick: "Background",
  },
  { key: "bg-dark", varName: "--color-composer-bg-dark", label: "Deep background", group: "Backgrounds", type: "seed" },
  {
    key: "bg-elevated",
    varName: "--color-composer-bg-elevated",
    label: "Surface / elevated",
    group: "Backgrounds",
    type: "seed",
    quick: "Surface",
  },
  {
    key: "overlay",
    varName: "--color-composer-overlay",
    label: "Overlay",
    group: "Backgrounds",
    type: "alpha",
    alpha: 0.2,
    on: "shadow",
  },
  {
    key: "overlay-hover",
    varName: "--color-composer-overlay-hover",
    label: "Overlay hover",
    group: "Backgrounds",
    type: "alpha",
    alpha: 0.3,
    on: "shadow",
  },
  { key: "text", varName: "--color-composer-text", label: "Text", group: "Text", type: "seed", quick: "Text" },
  {
    key: "text-secondary",
    varName: "--color-composer-text-secondary",
    label: "Secondary text",
    group: "Text",
    type: "alpha",
    alpha: 0.75,
    on: "fg",
  },
  {
    key: "text-muted",
    varName: "--color-composer-text-muted",
    label: "Muted text",
    group: "Text",
    type: "alpha",
    alpha: 0.5,
    on: "fg",
    quick: "Muted text",
  },
  {
    key: "text-disabled",
    varName: "--color-composer-text-disabled",
    label: "Disabled text",
    group: "Text",
    type: "alpha",
    alpha: 0.4,
    on: "fg",
  },
  {
    key: "text-tertiary",
    varName: "--color-composer-text-tertiary",
    label: "Tertiary text",
    group: "Text",
    type: "seed",
  },
  { key: "text-faint", varName: "--color-composer-text-faint", label: "Faint text", group: "Text", type: "seed" },
  {
    key: "button",
    varName: "--color-composer-button",
    label: "Button",
    group: "Interactive",
    type: "alpha",
    alpha: 0.1,
    on: "fg",
  },
  {
    key: "button-hover",
    varName: "--color-composer-button-hover",
    label: "Button hover",
    group: "Interactive",
    type: "alpha",
    alpha: 0.2,
    on: "fg",
  },
  {
    key: "input",
    varName: "--color-composer-input",
    label: "Input",
    group: "Interactive",
    type: "alpha",
    alpha: 0.05,
    on: "fg",
  },
  {
    key: "border",
    varName: "--color-composer-border",
    label: "Border",
    group: "Interactive",
    type: "alpha",
    alpha: 0.1,
    on: "fg",
    quick: "Border",
  },
  {
    key: "border-hover",
    varName: "--color-composer-border-hover",
    label: "Border hover",
    group: "Interactive",
    type: "alpha",
    alpha: 0.15,
    on: "fg",
  },
  {
    key: "accent",
    varName: "--color-composer-accent",
    label: "Accent",
    group: "Accent",
    type: "seed",
    quick: "Accent",
  },
  {
    key: "accent-dark",
    varName: "--color-composer-accent-dark",
    label: "Accent dark",
    group: "Accent",
    type: "shade",
    from: "accent",
    lighten: -0.08,
  },
  {
    key: "accent-darker",
    varName: "--color-composer-accent-darker",
    label: "Accent darker",
    group: "Accent",
    type: "shade",
    from: "accent",
    lighten: -0.16,
  },
  {
    key: "accent-text",
    varName: "--color-composer-accent-text",
    label: "Accent text",
    group: "Accent",
    type: "shade",
    from: "accent",
    lighten: 0.14,
    quick: "Accent text",
  },
  {
    key: "on-accent",
    varName: "--color-composer-on-accent",
    label: "Text on accent",
    group: "Accent",
    type: "contrast",
    from: "accent-dark",
  },
  {
    key: "accent-warm",
    varName: "--color-composer-accent-warm",
    label: "Background-vocal accent",
    group: "Accent",
    type: "seed",
    quick: "BG vocal accent",
  },
  { key: "link", varName: "--color-composer-link", label: "Link", group: "Accent", type: "seed" },
  { key: "error", varName: "--color-composer-error", label: "Error", group: "Status", type: "seed", quick: "Error" },
  { key: "error-text", varName: "--color-composer-error-text", label: "Error text", group: "Status", type: "seed" },
  {
    key: "warning",
    varName: "--color-composer-warning",
    label: "Warning",
    group: "Status",
    type: "seed",
    quick: "Warning",
  },
  { key: "explicit", varName: "--color-composer-explicit", label: "Explicit", group: "Status", type: "seed" },
  { key: "wave", varName: "--color-composer-wave", label: "Waveform", group: "Waveform", type: "seed" },
  {
    key: "wave-progress",
    varName: "--color-composer-wave-progress",
    label: "Waveform played",
    group: "Waveform",
    type: "shade",
    from: "accent",
    lighten: 0,
  },
  { key: "snap", varName: "--color-composer-snap", label: "Snap guideline", group: "Waveform", type: "seed" },
  { key: "onset", varName: "--color-composer-onset", label: "Vocal onset", group: "Waveform", type: "seed" },
];

const SEED_TOKENS: TokenKey[] = TOKENS.filter((t) => t.type === "seed").map((t) => t.key);

const QUICK_TOKENS: TokenMeta[] = TOKENS.filter((t) => t.quick !== undefined);

const TOKEN_VAR: Record<TokenKey, string> = Object.fromEntries(TOKENS.map((t) => [t.key, t.varName])) as Record<
  TokenKey,
  string
>;

export type { Scheme, TokenKey, ThemeId, Theme, ResolvedTheme, TokenType, TokenMeta };
export { TOKENS, SEED_TOKENS, QUICK_TOKENS, TOKEN_VAR };
