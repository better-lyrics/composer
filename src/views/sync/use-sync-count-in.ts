import { useEscapeLayer } from "@/hooks/useEscapeLayer";
import { cancelCountIn } from "@/lib/sync-count-in";
import { useSyncCountInStore } from "@/stores/sync-count-in";
import { useEffect } from "react";

// -- Hook ---------------------------------------------------------------------

function useSyncCountIn(): boolean {
  const countingIn = useSyncCountInStore((s) => s.endsAt !== null);
  useEscapeLayer("panel", countingIn, cancelCountIn);
  useEffect(() => cancelCountIn, []);
  return countingIn;
}

// -- Exports ------------------------------------------------------------------

export { useSyncCountIn };
