import { type RoformerSupport, probeRoformerSupport } from "@/audio/separation/roformer/availability";
import { useEffect, useState } from "react";

/** Whether this GPU can run the high quality vocal model; null until probed. */
function useRoformerSupport(): RoformerSupport | null {
  const [support, setSupport] = useState<RoformerSupport | null>(null);
  useEffect(() => {
    let live = true;
    probeRoformerSupport().then((result) => live && setSupport(result));
    return () => {
      live = false;
    };
  }, []);
  return support;
}

export { useRoformerSupport };
