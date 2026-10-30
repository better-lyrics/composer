import { useEffect, useState } from "react";

// -- Types --------------------------------------------------------------------

interface WindowSize {
  width: number;
  height: number;
}

// -- Helpers ------------------------------------------------------------------

function readWindowSize(): WindowSize {
  return { width: window.innerWidth, height: window.innerHeight };
}

// -- Hook ---------------------------------------------------------------------

function useWindowSize(): WindowSize {
  const [size, setSize] = useState(readWindowSize);
  useEffect(() => {
    const handleResize = () => setSize(readWindowSize());
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);
  return size;
}

// -- Exports ------------------------------------------------------------------

export { useWindowSize };
export type { WindowSize };
