import { type McpBridgeStatus, mcpBridgeStatusSnapshot, subscribeMcpBridgeStatus } from "@/lib/mcp/bridge-status";
import { useSettingsStore } from "@/stores/settings";
import { settingEntry } from "@/stores/settings-catalog";
import { CopyableCommand } from "@/ui/settings/copyable-command";
import { Switch } from "@/ui/switch";
import { stripTrailingSlashes } from "@/utils/url";
import { IconCheck, IconExclamationCircle, IconLoader2 } from "@tabler/icons-react";
import { useSyncExternalStore } from "react";

// -- Constants ----------------------------------------------------------------

const STATUS_COPY: Record<Exclude<McpBridgeStatus, "off">, string> = {
  connecting: "Waiting for Composer Bridge",
  connected: "Connected. Agents can reach the project open in this tab.",
  outdated: "Composer Bridge is running but can't relay agents yet. Update it.",
};

// -- Sub-components -----------------------------------------------------------

const StatusLine: React.FC<{ status: McpBridgeStatus }> = ({ status }) => {
  if (status === "off") return null;
  const Icon = status === "connected" ? IconCheck : status === "connecting" ? IconLoader2 : IconExclamationCircle;
  const tone =
    status === "connected"
      ? "text-emerald-500"
      : status === "connecting"
        ? "text-composer-text-muted"
        : "text-rose-500";
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs ${tone}`}>
      <Icon size={12} className={status === "connecting" ? "animate-spin" : undefined} />
      {STATUS_COPY[status]}
    </span>
  );
};

// -- Component ----------------------------------------------------------------

const McpAccessSetting: React.FC = () => {
  const entry = settingEntry("mcpAccess");
  const enabled = useSettingsStore((s) => s.mcpAccess);
  const bridgeUrl = useSettingsStore((s) => s.composerBridgeUrl);
  const toggle = useSettingsStore((s) => s.toggle);
  const status = useSyncExternalStore(subscribeMcpBridgeStatus, mcpBridgeStatusSnapshot, () => "off" as const);
  const endpoint = `${stripTrailingSlashes(bridgeUrl)}/mcp`;

  return (
    <div className="py-3">
      <div className="flex items-start justify-between mb-3">
        <div className="flex flex-col gap-0.5 pr-4">
          <span className="text-sm font-medium text-composer-text">
            {entry.label}
            <span className="ml-2 text-[10px] tracking-wide text-composer-accent-text">Experimental</span>
          </span>
          <span className="text-xs text-composer-text-muted">{entry.description}</span>
        </div>
        <Switch checked={enabled} label={entry.label} onCheckedChange={() => toggle("mcpAccess")} />
      </div>

      {enabled && (
        <div className="flex flex-col gap-2 px-3 py-3 rounded-md bg-(--well) border border-(--edge)">
          <StatusLine status={status} />
          <p className="text-xs text-composer-text-muted">Add Composer to Claude Code:</p>
          <CopyableCommand
            command={`claude mcp add --transport http composer ${endpoint}`}
            copyLabel="Copy the Claude Code command"
          />
          <p className="text-xs text-composer-text-muted">Or to Codex, in ~/.codex/config.toml:</p>
          <CopyableCommand
            command={`[mcp_servers.composer]\nurl = "${endpoint}"`}
            copyLabel="Copy the Codex configuration"
          />
        </div>
      )}
    </div>
  );
};

// -- Exports ------------------------------------------------------------------

export { McpAccessSetting };
