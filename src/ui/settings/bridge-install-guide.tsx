import { Button } from "@/ui/button";
import { CopyableCommand } from "@/ui/settings/copyable-command";
import { BRIDGE_REPO_URL } from "@/utils/composer-bridge-api";
import { IconExternalLink, IconRefresh } from "@tabler/icons-react";

// -- Constants ----------------------------------------------------------------

const RELEASES_URL = `${BRIDGE_REPO_URL}/releases/latest`;
const INSTALL_CMD = `curl -fsSL ${RELEASES_URL}/download/install.sh | sh`;

// -- Sub-components -----------------------------------------------------------

const StepHeader: React.FC<{ index: number; title: string }> = ({ index, title }) => (
  <div className="flex items-baseline gap-2">
    <span className="text-xs font-mono text-composer-text-muted w-4">{index}.</span>
    <h3 className="text-sm font-medium text-composer-text">{title}</h3>
  </div>
);

// -- Component ----------------------------------------------------------------

interface BridgeInstallGuideProps {
  onCheckNow: () => void;
}

const BridgeInstallGuide: React.FC<BridgeInstallGuideProps> = ({ onCheckNow }) => (
  <div className="flex flex-col gap-3 text-xs text-composer-text-muted leading-relaxed">
    <div className="flex flex-col gap-1.5">
      <StepHeader index={1} title="Install" />
      <p>
        Open Terminal (macOS or Linux) and paste the command below to install{" "}
        <a
          href={BRIDGE_REPO_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2 transition-colors hover:text-composer-text"
        >
          Composer Bridge
        </a>
        . It picks the right build for your machine, verifies the checksum, and installs to{" "}
        <code className="font-mono text-[11px] px-1 bg-composer-bg rounded">/Applications</code> on Mac or{" "}
        <code className="font-mono text-[11px] px-1 bg-composer-bg rounded">~/.local/bin</code> on Linux.
      </p>
      <CopyableCommand command={INSTALL_CMD} copyLabel="Copy install command" />
      <a
        href={RELEASES_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="text-composer-accent-text underline underline-offset-2 transition-colors hover:text-composer-accent w-fit inline-flex items-center gap-1"
      >
        Windows or manual download <IconExternalLink size={11} />
      </a>
    </div>

    <div className="flex flex-col gap-1.5">
      <StepHeader index={2} title="Launch" />
      <p>
        Open Composer Bridge. The app runs in the background. Look for its icon in your menu bar (Mac) or system tray
        (Windows or Linux). Leave it running.
      </p>
    </div>

    <div className="flex flex-col gap-1.5">
      <StepHeader index={3} title="Return here" />
      <p>Once the bridge is running, this card goes green automatically. No restart needed.</p>
      <Button variant="secondary" size="sm" hasIcon onClick={onCheckNow} className="mt-2 w-fit">
        <IconRefresh size={12} />
        Check now
      </Button>
    </div>
  </div>
);

// -- Exports ------------------------------------------------------------------

export { BridgeInstallGuide };
