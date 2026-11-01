import { useState } from "react";

// -- Hook ---------------------------------------------------------------------

// The latest non-null value, kept after the value goes null, so a closing layer can play its exit.
function useLastPresent<T>(value: T | null): T | null {
  const [last, setLast] = useState(value);
  if (value !== null && value !== last) setLast(value);
  return value ?? last;
}

// -- Exports ------------------------------------------------------------------

export { useLastPresent };
