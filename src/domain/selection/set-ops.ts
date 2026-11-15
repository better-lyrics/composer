import { sameAddress } from "@/domain/selection/identity";
import type { SyllableAddress } from "@/domain/selection/model";

// -- Set operations -----------------------------------------------------------

function toggleAddress<A extends SyllableAddress>(addresses: A[], address: A): A[] {
  if (addresses.some((a) => sameAddress(a, address))) return addresses.filter((a) => !sameAddress(a, address));
  return [...addresses, address];
}

// Union of two address lists, deduped. Existing entries keep their position; incoming entries are appended only when not already present.
function mergeAddresses<A extends SyllableAddress>(existing: A[], incoming: A[]): A[] {
  const merged = [...existing];
  for (const address of incoming) {
    if (!merged.some((a) => sameAddress(a, address))) merged.push(address);
  }
  return merged;
}

// -- Exports ------------------------------------------------------------------

export { mergeAddresses, toggleAddress };
