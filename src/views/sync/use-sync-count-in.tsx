import { useEscapeLayer } from "@/hooks/useEscapeLayer";
import { cancelCountIn } from "@/lib/sync-count-in";
import { useSyncCountInStore } from "@/stores/sync-count-in";
import { CountInDots } from "@/views/sync/count-in-dots";
import { CountInStatus } from "@/views/sync/count-in-status";
import { useEffect } from "react";

// -- Interfaces ---------------------------------------------------------------

interface SyncCountInView {
  countingIn: boolean;
  dots: React.ReactNode;
  status: React.ReactNode;
}

// -- Hook ---------------------------------------------------------------------

function useSyncCountIn(): SyncCountInView {
  const countingIn = useSyncCountInStore((s) => s.endsAt !== null);
  useEscapeLayer("panel", countingIn, cancelCountIn);
  useEffect(() => cancelCountIn, []);
  if (!countingIn) return { countingIn, dots: undefined, status: undefined };
  return { countingIn, dots: <CountInDots />, status: <CountInStatus /> };
}

// -- Exports ------------------------------------------------------------------

export { useSyncCountIn };
