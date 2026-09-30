import type { StorageProtection } from "@/lib/browser-storage";
import { Button } from "@/ui/button";
import { InlineKeyBadge } from "@/ui/inline-key-badge";
import { SettingLink } from "@/ui/setting-link";
import { SettingRowLayout } from "@/ui/settings/setting-row-layout";
import { SettingText } from "@/ui/settings/setting-text";
import { StatusChip } from "@/ui/status-chip";
import type { BrowserKind } from "@/utils/platform";
import { IconShieldCheck, IconShieldExclamation } from "@tabler/icons-react";
import { useEffect, useRef } from "react";

// -- Types --------------------------------------------------------------------

interface StorageProtectionRowProps {
  status: StorageProtection | undefined;
  browser: BrowserKind;
  isProtecting?: boolean;
  onProtect: () => void;
}

// -- Constants ----------------------------------------------------------------

const PROTECTED_DESCRIPTION = "The browser won't clear your projects when disk space runs low.";
const UNPROTECTED_DESCRIPTION = "The browser can clear your projects, lyrics included, when disk space runs low.";
const INSTALL_MENU_ITEM = "Install page as app";

// -- Sub-components -------------------------------------------------------------

const ChromiumSteps: React.FC = () => (
  <span className="leading-[1.7]">
    {UNPROTECTED_DESCRIPTION} To turn it on, use <InlineKeyBadge text={INSTALL_MENU_ITEM} /> in the browser menu or
    bookmark Composer, then ask again. This doesn't work in Incognito.
  </span>
);

const UnsupportedDescription: React.FC = () => (
  <span>
    This browser can't protect storage, so it may clear your projects when disk space runs low. Use{" "}
    <SettingLink setting="backUpAllProjects" /> now and then.
  </span>
);

function descriptionFor(status: StorageProtection, browser: BrowserKind): React.ReactNode {
  if (status === "protected") return PROTECTED_DESCRIPTION;
  if (status === "unsupported") return <UnsupportedDescription />;
  return browser === "chromium" ? <ChromiumSteps /> : UNPROTECTED_DESCRIPTION;
}

const ProtectionChip: React.FC<{ status: StorageProtection }> = ({ status }) => {
  if (status === "protected") {
    return (
      <StatusChip tone="positive" icon={IconShieldCheck}>
        On
      </StatusChip>
    );
  }
  return (
    <StatusChip tone="warning" icon={IconShieldExclamation}>
      {status === "unsupported" ? "Unavailable" : "Off"}
    </StatusChip>
  );
};

// -- Component ----------------------------------------------------------------

const StorageProtectionRow: React.FC<StorageProtectionRowProps> = ({
  status,
  browser,
  isProtecting = false,
  onProtect,
}) => {
  const statusRef = useRef<HTMLSpanElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const awaitingAnswerRef = useRef(false);

  useEffect(() => {
    if (isProtecting || !awaitingAnswerRef.current) return;
    awaitingAnswerRef.current = false;
    (status === "unprotected" ? buttonRef.current : statusRef.current)?.focus();
  }, [status, isProtecting]);

  if (status === undefined) return null;

  const protect = () => {
    awaitingAnswerRef.current = true;
    onProtect();
  };

  return (
    <SettingRowLayout>
      <SettingText
        id="storageProtection"
        badge={
          <span ref={statusRef} role="status" tabIndex={-1}>
            <ProtectionChip status={status} />
          </span>
        }
        description={descriptionFor(status, browser)}
      />
      {status === "unprotected" && (
        <Button ref={buttonRef} variant="secondary" size="sm" disabled={isProtecting} onClick={protect}>
          Protect storage
        </Button>
      )}
    </SettingRowLayout>
  );
};

// -- Exports ------------------------------------------------------------------

export { StorageProtectionRow };
