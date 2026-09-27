import { type Scheme, type TokenKey, TOKEN_VAR } from "@/domain/theme/model";
import { type PrismTheme, themes } from "prism-react-renderer";

// -- Helpers ------------------------------------------------------------------

const token = (key: TokenKey) => `var(${TOKEN_VAR[key]})`;

// -- Themes -------------------------------------------------------------------

const DARK_THEME: PrismTheme = {
  ...themes.nightOwl,
  plain: { ...themes.nightOwl.plain, backgroundColor: token("bg-elevated") },
};

// Night Owl's pale palette is unreadable on a light background, so light themes draw from the theme tokens.
const LIGHT_THEME: PrismTheme = {
  plain: { color: token("text"), backgroundColor: token("bg-elevated") },
  styles: [
    { types: ["tag"], style: { color: token("accent-text") } },
    { types: ["attr-name"], style: { color: token("link") } },
    { types: ["attr-value", "string"], style: { color: token("positive") } },
    { types: ["comment", "prolog", "doctype", "cdata"], style: { color: token("text-muted") } },
    { types: ["punctuation"], style: { color: token("text-secondary") } },
  ],
};

// -- Functions ----------------------------------------------------------------

function codeHighlightThemeFor(scheme: Scheme): PrismTheme {
  return scheme === "light" ? LIGHT_THEME : DARK_THEME;
}

// -- Exports ------------------------------------------------------------------

export { codeHighlightThemeFor };
