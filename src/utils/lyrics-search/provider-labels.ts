import type { ProviderName } from "@/domain/lyrics-search/result";
import { getProviders } from "@/utils/lyrics-search/registry";

// -- Constants ----------------------------------------------------------------

const PROVIDER_LIST_FORMATTER = new Intl.ListFormat("en", { style: "long", type: "conjunction" });

// -- Labels -------------------------------------------------------------------

function formatProviderName(name: ProviderName): string {
  return getProviders().find((provider) => provider.name === name)?.sourceLabel ?? name;
}

function providerLabelsProse(): string {
  return PROVIDER_LIST_FORMATTER.format(getProviders().map((provider) => provider.sourceLabel));
}

// -- Exports ------------------------------------------------------------------

export { formatProviderName, providerLabelsProse };
