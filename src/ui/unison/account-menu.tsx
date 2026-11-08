import { IconCloudUpload, IconExternalLink, IconLogout } from "@tabler/icons-react";
import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useUnisonProfile } from "@/hooks/unison/useUnisonProfile";
import { useUnisonSession } from "@/hooks/useUnisonSession";
import type { StoredUnisonSession } from "@/lib/unison/session";
import { signOutOfUnison } from "@/lib/unison/sign-out";
import { unisonProfileUrl } from "@/lib/unison/web-urls";
import { Button } from "@/ui/button";
import { HEADER_ICON_STYLES } from "@/ui/header-icon-styles";
import { IconButton } from "@/ui/icon-button";
import { Menu, type MenuAnchor, MenuItem, MenuSeparator } from "@/ui/menu";
import { menuTriggerProps } from "@/ui/menu-trigger-props";
import { AccountStats } from "@/ui/unison/account-stats";
import { BetterLyricsMark } from "@/ui/unison/better-lyrics-mark";
import { ConnectPopover } from "@/ui/unison/connect-popover";
import { UnisonAvatar } from "@/ui/unison/unison-avatar";
import { unisonViewPath } from "@/utils/app-routes";

// -- Components ----------------------------------------------------------------

const AccountMenu: React.FC<{ session: StoredUnisonSession }> = ({ session }) => {
  // Loads with the header, so the account menu and the Unison page open with the profile ready.
  useUnisonProfile(session.keyId);
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
        className="w-[272px] rounded-[14px]"
      >
        <AccountStats session={session} />
        <MenuItem icon={IconCloudUpload} label="My Unison lyrics" onSelect={() => navigate(unisonViewPath("mine"))} />
        <MenuItem
          icon={IconExternalLink}
          label="Profile on Unison"
          onSelect={() => window.open(unisonProfileUrl(session.keyId), "_blank", "noopener,noreferrer")}
        />
        <MenuSeparator />
        <MenuItem icon={IconLogout} label="Disconnect" onSelect={signOutOfUnison} />
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
