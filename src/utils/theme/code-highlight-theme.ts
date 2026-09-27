import { type TokenKey, TOKEN_VAR } from "@/domain/theme/model";
import type { PrismTheme } from "prism-react-renderer";

// -- Helpers ------------------------------------------------------------------

const token = (key: TokenKey) => `var(${TOKEN_VAR[key]})`;

// -- Theme --------------------------------------------------------------------

const codeHighlightTheme: PrismTheme = {
  plain: { color: token("text"), backgroundColor: token("bg-elevated") },
  styles: [
    { types: ["tag"], style: { color: token("accent-text") } },
    { types: ["attr-name"], style: { color: token("link") } },
    { types: ["attr-value", "string"], style: { color: token("positive") } },
    { types: ["comment", "prolog", "doctype", "cdata"], style: { color: token("text-muted") } },
    { types: ["punctuation"], style: { color: token("text-secondary") } },
  ],
};

// -- Exports ------------------------------------------------------------------

export { codeHighlightTheme };
