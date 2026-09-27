import { useState } from "react";

// The input keeps what the user typed until the store moves to a value that draft no longer normalizes to.
function useNormalizedDraft(
  stored: string | undefined,
  normalize: (value: string) => string | undefined,
): [string, (value: string) => void] {
  const [draft, setDraft] = useState(() => stored ?? "");
  const value = normalize(draft) === stored ? draft : (stored ?? "");
  return [value, setDraft];
}

export { useNormalizedDraft };
