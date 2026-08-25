import type { ProviderName } from "@/domain/lyrics-search/result";

// -- Constants ----------------------------------------------------------------

// Keyed on ProviderName so a new provider is a compile error until it has a label.
const PROVIDER_DISPLAY_NAMES: Record<ProviderName, string> = {
  lrclib: "LRCLib",
  binimum: "Binimum",
  "boidu-lyrics": "Better Lyrics",
  qq: "QQ Music",
};

// -- Helpers ------------------------------------------------------------------

function formatProviderName(name: ProviderName): string {
  return PROVIDER_DISPLAY_NAMES[name];
}

// -- Exports ------------------------------------------------------------------

export { formatProviderName, PROVIDER_DISPLAY_NAMES };
