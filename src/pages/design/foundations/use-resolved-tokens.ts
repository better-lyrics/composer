import { useThemeStore } from "@/stores/theme";
import { useSyncExternalStore } from "react";

// -- Types ---------------------------------------------------------------------

type ResolvedTokens = Record<string, string>;

interface CachedSnapshot {
  key: string;
  tokens: ResolvedTokens;
}

// -- Constants -----------------------------------------------------------------

const SERVER_SNAPSHOT: ResolvedTokens = {};

const snapshotsByNames = new Map<string, CachedSnapshot>();

// -- Functions -----------------------------------------------------------------

function subscribeToTheme(onChange: () => void): () => void {
  return useThemeStore.subscribe((state, previous) => {
    if (state.activeThemeId !== previous.activeThemeId || state.customThemes !== previous.customThemes) onChange();
  });
}

function readTokens(names: readonly string[]): ResolvedTokens {
  const cacheKey = names.join("|");
  const rootStyle = getComputedStyle(document.documentElement);
  const values = names.map((name) => rootStyle.getPropertyValue(name).trim());
  const valuesKey = values.join("|");
  const cached = snapshotsByNames.get(cacheKey);
  if (cached?.key === valuesKey) return cached.tokens;
  const tokens = Object.fromEntries(names.map((name, index) => [name, values[index]]));
  snapshotsByNames.set(cacheKey, { key: valuesKey, tokens });
  return tokens;
}

// -- Hooks ---------------------------------------------------------------------

function useResolvedTokens(names: readonly string[]): ResolvedTokens {
  return useSyncExternalStore(
    subscribeToTheme,
    () => readTokens(names),
    () => SERVER_SNAPSHOT,
  );
}

// -- Exports -------------------------------------------------------------------

export { useResolvedTokens };
