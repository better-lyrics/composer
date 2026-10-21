import { useEffect, useRef, useState } from "react";

// -- Hook ---------------------------------------------------------------------

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  const latestValueRef = useRef(value);
  latestValueRef.current = value;

  useEffect(() => {
    if (delay <= 0) {
      setDebounced(value);
      return;
    }
    const timer = setTimeout(() => {
      setDebounced(latestValueRef.current);
    }, delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

// -- Exports ------------------------------------------------------------------

export { useDebouncedValue };
