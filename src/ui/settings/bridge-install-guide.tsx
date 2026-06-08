import { IconDownload, IconRefresh } from "@tabler/icons-react";
import { detectPlatform, type Platform } from "@/utils/detect-platform";

// -- Constants ----------------------------------------------------------------

const RELEASE_BASE = "https://github.com/boidushya/composer-bridge/releases/latest";
const DOWNLOAD = (asset: string) => `${RELEASE_BASE}/download/${asset}`;

const ASSET = {
  macArm64: "Composer-Bridge-darwin-arm64.dmg",
  macAmd64: "Composer-Bridge-darwin-amd64.dmg",
  windows: "Composer-Bridge-Setup.exe",
  linux: "composer-bridge.AppImage",
};

// -- Sub-components -----------------------------------------------------------

const StepHeader: React.FC<{ index: number; title: string }> = ({ index, title }) => (
  <div className="flex items-baseline gap-2">
    <span className="text-xs font-mono text-composer-text-muted w-4">{index}.</span>
    <h3 className="text-sm font-medium text-composer-text">{title}</h3>
  </div>
);

const DownloadButton: React.FC<{ label: string; href: string; primary?: boolean }> = ({ label, href, primary }) => (
  <a
    href={href}
    target="_blank"
    rel="noopener noreferrer"
    className={
      primary
        ? "inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium bg-composer-accent text-white hover:bg-composer-accent/90 cursor-pointer"
        : "inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium bg-composer-input text-composer-text border border-composer-border hover:border-composer-accent cursor-pointer"
    }
  >
    <IconDownload size={12} />
    {label}
  </a>
);

const DownloadStep: React.FC<{ platform: Platform }> = ({ platform }) => {
  if (platform.os === "mac") {
    const both = platform.arch === "unknown";
    return (
      <div className="flex flex-wrap gap-2">
        <DownloadButton
          label="macOS (Apple Silicon)"
          href={DOWNLOAD(ASSET.macArm64)}
          primary={platform.arch !== "amd64"}
        />
        <DownloadButton
          label="macOS (Intel)"
          href={DOWNLOAD(ASSET.macAmd64)}
          primary={!both && platform.arch === "amd64"}
        />
      </div>
    );
  }
  if (platform.os === "windows")
    return <DownloadButton label="Download for Windows" href={DOWNLOAD(ASSET.windows)} primary />;
  if (platform.os === "linux")
    return <DownloadButton label="Download for Linux" href={DOWNLOAD(ASSET.linux)} primary />;
  return <DownloadButton label="See all releases" href={RELEASE_BASE} primary />;
};

const InstallCopy: React.FC<{ platform: Platform }> = ({ platform }) => {
  if (platform.os === "mac") {
    return (
      <p>
        Open the .dmg and drag Composer Bridge to Applications. The first launch shows a security warning since the
        binary is unsigned: right-click the app icon, choose Open, then click Open in the confirm dialog. You only do
        this once.
      </p>
    );
  }
  if (platform.os === "windows") {
    return (
      <p>
        Run the Setup.exe. SmartScreen may warn you because the binary is unsigned. Click "More info", then "Run
        anyway". You only do this once.
      </p>
    );
  }
  if (platform.os === "linux") {
    return (
      <p>
        Make the AppImage executable with{" "}
        <code className="font-mono text-[11px] px-1 bg-composer-bg rounded">chmod +x composer-bridge.AppImage</code>,
        then double-click or run it from the terminal.
      </p>
    );
  }
  return (
    <p>
      macOS: open the .dmg and drag to Applications. Windows: run Setup.exe and click through SmartScreen. Linux:
      <code className="font-mono text-[11px] px-1 mx-1 bg-composer-bg rounded">chmod +x</code>
      the AppImage and run it.
    </p>
  );
};

// -- Component ----------------------------------------------------------------

interface BridgeInstallGuideProps {
  onCheckNow: () => void;
  uaOverride?: string;
}

const BridgeInstallGuide: React.FC<BridgeInstallGuideProps> = ({ onCheckNow, uaOverride }) => {
  const platform = detectPlatform(uaOverride ?? navigator.userAgent);

  return (
    <div className="flex flex-col gap-3 text-xs text-composer-text-muted leading-relaxed">
      <div className="flex flex-col gap-1.5">
        <StepHeader index={1} title="Download" />
        <DownloadStep platform={platform} />
        <a
          href={RELEASE_BASE}
          target="_blank"
          rel="noopener noreferrer"
          className="text-composer-accent-text hover:text-composer-accent underline w-fit"
        >
          Other platforms
        </a>
      </div>

      <div className="flex flex-col gap-1.5">
        <StepHeader index={2} title="Install" />
        <InstallCopy platform={platform} />
      </div>

      <div className="flex flex-col gap-1.5">
        <StepHeader index={3} title="Launch" />
        <p>
          Open Composer Bridge. The app runs in the background; look for its icon in your menu bar (Mac) or system tray
          (Windows / Linux). Leave it running.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <StepHeader index={4} title="Return here" />
        <p>Once the bridge is running, this card goes green automatically. No restart needed.</p>
        <button
          type="button"
          onClick={onCheckNow}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium bg-composer-input text-composer-text border border-composer-border hover:border-composer-accent cursor-pointer w-fit"
        >
          <IconRefresh size={12} />
          Check now
        </button>
      </div>
    </div>
  );
};

// -- Exports ------------------------------------------------------------------

export { BridgeInstallGuide };
export type { BridgeInstallGuideProps };
