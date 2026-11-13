import { useState } from "react";

// -- Hook ---------------------------------------------------------------------

function useErrorAfterBlur(invalid: boolean): { shown: boolean; reveal: () => void } {
  const [blurred, setBlurred] = useState(false);
  if (blurred && !invalid) setBlurred(false);
  return { shown: invalid && blurred, reveal: () => setBlurred(invalid) };
}

// -- Exports ------------------------------------------------------------------

export { useErrorAfterBlur };
