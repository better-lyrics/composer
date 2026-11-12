import type { ProviderName } from "@/domain/lyrics-search/result";
import { getProviders } from "@/utils/lyrics-search/registry";
import { proseList } from "@/utils/prose-list";

// -- Labels -------------------------------------------------------------------

function formatProviderName(name: ProviderName): string {
  return getProviders().find((provider) => provider.name === name)?.sourceLabel ?? name;
}

function providerLabelsProse(): string {
  return proseList(getProviders().map((provider) => provider.sourceLabel));
}

// -- Exports ------------------------------------------------------------------

export { formatProviderName, providerLabelsProse };
