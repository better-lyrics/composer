import { useSettingsStore } from "@/stores/settings";
import { settingEntry } from "@/stores/settings-catalog";
import { BridgeInstallGuide } from "@/ui/settings/bridge-install-guide";
import { BridgeUrlField } from "@/ui/settings/bridge-url-field";
import { Switch } from "@/ui/switch";
import { hasBridgeEverBeenDetected, markBridgeDetected } from "@/utils/bridge-detection";
import { DEFAULT_BRIDGE_URL } from "@/utils/composer-bridge-url";
import { BRIDGE_REPO_URL, type BridgeHealth, HEALTH_QUERY_KEY, checkBridgeHealth } from "@/utils/composer-bridge-api";
import { IconCheck, IconExclamationCircle, IconLoader2 } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";

// -- Constants ----------------------------------------------------------------

const HEALTH_REFETCH_INTERVAL = 8000;

// -- Sub-components -----------------------------------------------------------

const StatusBadge: React.FC<{
  state: "checking" | "ok" | "error";
  data: BridgeHealth | undefined;
  errorMessage: string | undefined;
}> = ({ state, data, errorMessage }) => {
  if (state === "checking") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-composer-text-muted">
        <IconLoader2 size={12} className="animate-spin" />
        Checking…
      </span>
    );
  }
  if (state === "ok" && data) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-emerald-500" title={`yt-dlp ${data.ytdlp}`}>
        <IconCheck size={12} />
        Running · bridge {data.bridge} · yt-dlp {data.ytdlp}
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs text-rose-500"
      title={errorMessage ?? "bridge unreachable"}
    >
      <IconExclamationCircle size={12} />
      Not running
    </span>
  );
};

// -- Sub-sections -------------------------------------------------------------

const BridgeStoppedHint: React.FC = () => (
  <div className="text-xs text-composer-text-muted leading-relaxed">
    <p className="mb-1">Bridge isn't responding at this address. Start it with:</p>
    <code className="block px-2 py-1 rounded bg-composer-bg font-mono text-[11px] select-text">composer-bridge</code>
    <p className="mt-2">
      If you don't have it yet, grab a binary from{" "}
      <a
        href="https://github.com/better-lyrics/composer-bridge/releases"
        target="_blank"
        rel="noopener noreferrer"
        className="text-composer-accent-text hover:text-composer-accent underline"
      >
        releases
      </a>
      .
    </p>
  </div>
);

// -- Section ------------------------------------------------------------------

const BridgeSection: React.FC = () => {
  const enabled = useSettingsStore((s) => s.experiments.youtubeBridge);
  const bridgeUrl = useSettingsStore((s) => s.composerBridgeUrl);
  const setSetting = useSettingsStore((s) => s.set);

  const toggleEnabled = () => {
    const current = useSettingsStore.getState().experiments;
    setSetting("experiments", { ...current, youtubeBridge: !current.youtubeBridge });
  };

  const commitUrl = (url: string) => {
    if (url !== bridgeUrl) setSetting("composerBridgeUrl", url);
  };

  const everDetectedAtMount = useMemo(() => hasBridgeEverBeenDetected(), []);

  const health = useQuery({
    queryKey: [HEALTH_QUERY_KEY, bridgeUrl],
    queryFn: ({ signal }) => checkBridgeHealth(bridgeUrl, signal),
    enabled,
    staleTime: 0,
    gcTime: 0,
    refetchInterval: enabled ? HEALTH_REFETCH_INTERVAL : false,
    retry: false,
  });

  useEffect(() => {
    if (health.data) markBridgeDetected();
  }, [health.data]);

  const state: "checking" | "ok" | "error" =
    health.isFetching && !health.data ? "checking" : health.data ? "ok" : "error";
  const errorMessage = health.error instanceof Error ? health.error.message : undefined;

  return (
    <div data-testid="bridge-section" className="py-3">
      <div className="flex items-start justify-between mb-3">
        <div className="flex flex-col gap-0.5 pr-4">
          <span className="text-sm font-medium text-composer-text">
            {settingEntry("youtubeBridge").label}
            <span className="ml-2 text-[10px] tracking-wide text-composer-accent-text">Experimental</span>
          </span>
          <span className="text-xs text-composer-text-muted">
            Route YouTube imports through a small local binary running on your machine instead of Cobalt. Uses your
            residential IP, so YouTube doesn't block it. Requires running{" "}
            <a
              href={BRIDGE_REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 transition-colors hover:text-composer-text"
            >
              Composer Bridge
            </a>
            .
          </span>
        </div>
        <Switch checked={enabled} label="Use Composer Bridge for YouTube" onCheckedChange={toggleEnabled} />
      </div>

      {enabled && (
        <div className="flex flex-col gap-2 px-3 py-3 rounded-md bg-(--well) border border-(--edge)">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-composer-text">Bridge status</span>
            <StatusBadge state={state} data={health.data} errorMessage={errorMessage} />
          </div>

          <BridgeUrlField
            key={bridgeUrl}
            initialUrl={bridgeUrl}
            onCommit={commitUrl}
            onReset={() => setSetting("composerBridgeUrl", DEFAULT_BRIDGE_URL)}
          />

          {state === "error" &&
            (everDetectedAtMount ? <BridgeStoppedHint /> : <BridgeInstallGuide onCheckNow={() => health.refetch()} />)}
        </div>
      )}
    </div>
  );
};

// -- Exports ------------------------------------------------------------------

export { BridgeSection };
