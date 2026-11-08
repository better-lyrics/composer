import { useUnisonSession } from "@/hooks/useUnisonSession";
import { signOutOfUnison } from "@/lib/unison/sign-out";
import { Button } from "@/ui/button";
import { SettingRowLayout } from "@/ui/settings/setting-row-layout";
import { SettingText } from "@/ui/settings/setting-text";
import { BetterLyricsMark } from "@/ui/unison/better-lyrics-mark";
import { ConnectPopover } from "@/ui/unison/connect-popover";
import { IconLogout } from "@tabler/icons-react";

// -- Component -----------------------------------------------------------------

const UnisonAccountSetting: React.FC = () => {
  const session = useUnisonSession();
  return (
    <SettingRowLayout>
      <SettingText
        id="unisonAccount"
        description={session ? `Connected as ${session.displayName}.` : "Not connected."}
      />
      {session ? (
        <Button size="lg" variant="secondary" hasIcon onClick={signOutOfUnison}>
          <IconLogout size={14} />
          Sign out
        </Button>
      ) : (
        <ConnectPopover
          placement="bottom-end"
          reason="Send lyrics to Unison and follow their reviews."
          trigger={
            <Button size="lg" variant="secondary" hasIcon>
              <BetterLyricsMark />
              Connect
            </Button>
          }
        />
      )}
    </SettingRowLayout>
  );
};

// -- Exports -------------------------------------------------------------------

export { UnisonAccountSetting };
