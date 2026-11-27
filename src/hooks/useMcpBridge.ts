import { startMcpBridgeSession } from "@/lib/mcp/bridge-session";
import { useSettingsStore } from "@/stores/settings";
import { useEffect } from "react";

// -- Hook ---------------------------------------------------------------------

function useMcpBridge(): void {
  const enabled = useSettingsStore((s) => s.mcpAccess);
  const bridgeUrl = useSettingsStore((s) => s.composerBridgeUrl);

  useEffect(() => {
    if (!enabled) return;
    return startMcpBridgeSession(bridgeUrl);
  }, [enabled, bridgeUrl]);
}

// -- Exports ------------------------------------------------------------------

export { useMcpBridge };
