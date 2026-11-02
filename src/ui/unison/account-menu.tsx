import { useUnisonSession } from "@/hooks/useUnisonSession";
import { logout } from "@/lib/unison/endpoints";
import { type StoredUnisonSession, clearUnisonSession } from "@/lib/unison/session";
import { unisonProfileUrl } from "@/lib/unison/web-urls";
import { Button } from "@/ui/button";
import { HEADER_ICON_STYLES } from "@/ui/header-icon-styles";
import { IconButton } from "@/ui/icon-button";
import { Menu, type MenuAnchor, MenuHeader, MenuItem, MenuSeparator } from "@/ui/menu";
import { menuTriggerProps } from "@/ui/menu-trigger-props";
import { BetterLyricsMark } from "@/ui/unison/better-lyrics-mark";
import { ConnectPopover } from "@/ui/unison/connect-popover";
import { UnisonAvatar } from "@/ui/unison/unison-avatar";
import { unisonViewPath } from "@/utils/app-routes";
import { showDisconnectedToast } from "@/utils/unison-toast";
import { IconCloudUpload, IconExternalLink, IconFlame, IconLogout } from "@tabler/icons-react";
import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";

// -- Constants -----------------------------------------------------------------

const LOG_PREFIX = "[UnisonAccount]";

// -- Helpers -------------------------------------------------------------------

function disconnect(): void {
  // logout() reads the token before its first await, so clearing right after still signs this session out.
  logout().catch((error: unknown) => {
    console.warn(LOG_PREFIX, "Could not end the session on Unison, cleared it here only", error);
  });
  clearUnisonSession();
  showDisconnectedToast();
}

// -- Components ----------------------------------------------------------------

const AccountMenu: React.FC<{ session: StoredUnisonSession }> = ({ session }) => {
  const navigate = useNavigate();
  const [anchor, setAnchor] = useState<MenuAnchor | null>(null);
  const close = useCallback(() => setAnchor(null), []);

  return (
    <>
      <IconButton
        label={`Unison account, ${session.displayName}`}
        icon={<UnisonAvatar avatarUrl={session.avatarUrl} />}
        variant="ghost"
        {...menuTriggerProps(anchor !== null)}
        onClick={(event) => setAnchor(anchor ? null : { kind: "element", element: event.currentTarget })}
        className={HEADER_ICON_STYLES}
      />
      <Menu
        anchor={anchor}
        align="end"
        onClose={close}
        aria-label="Unison account"
        className="w-[248px] rounded-[14px]"
      >
        <MenuHeader title={session.displayName} />
        <MenuItem icon={IconCloudUpload} label="My Unison lyrics" onSelect={() => navigate(unisonViewPath("mine"))} />
        <MenuItem icon={IconFlame} label="Most wanted" onSelect={() => navigate(unisonViewPath("wanted"))} />
        <MenuItem
          icon={IconExternalLink}
          label="Profile on Unison"
          onSelect={() => window.open(unisonProfileUrl(session.keyId), "_blank", "noopener,noreferrer")}
        />
        <MenuSeparator />
        <MenuItem icon={IconLogout} label="Disconnect" onSelect={disconnect} />
      </Menu>
    </>
  );
};

const HeaderConnect: React.FC = () => (
  <ConnectPopover
    trigger={
      <Button variant="ghost" size="lg" hasIcon aria-label="Connect Better Lyrics" className="text-(--label)">
        <BetterLyricsMark />
        Connect
      </Button>
    }
  />
);

const HeaderAccount: React.FC = () => {
  const session = useUnisonSession();
  return session ? <AccountMenu session={session} /> : <HeaderConnect />;
};

// -- Exports -------------------------------------------------------------------

export { HeaderAccount };
