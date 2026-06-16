import { type ResolvedTheme, type Scheme, TOKENS } from "@/domain/theme/model";

// -- Apply theme ---------------------------------------------------------------
// Writes a resolved token map onto documentElement as CSS custom properties and
// syncs color-scheme so native form controls and scrollbars match the theme.
// Also stamps data-scheme so CSS that cannot read a token value (glows, shadows)
// can branch on the active scheme.

function applyResolvedTheme(resolved: ResolvedTheme, scheme: Scheme): void {
  const root = document.documentElement;
  for (const t of TOKENS) root.style.setProperty(t.varName, resolved[t.key]);
  root.style.colorScheme = scheme;
  root.dataset.scheme = scheme;
}

// -- Exports -------------------------------------------------------------------

export { applyResolvedTheme };
