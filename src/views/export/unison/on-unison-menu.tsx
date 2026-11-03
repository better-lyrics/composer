import type { UnisonLyric } from "@/lib/unison/api-types";
import { unisonLyricPageUrl } from "@/lib/unison/web-urls";
import { IconButton } from "@/ui/icon-button";
import { Menu, type MenuAnchor, MenuItem, MenuSeparator } from "@/ui/menu";
import { menuTriggerProps } from "@/ui/menu-trigger-props";
import { IconDots, IconExternalLink, IconTrash } from "@tabler/icons-react";
import { useCallback, useState } from "react";

// -- Interfaces ----------------------------------------------------------------

interface OnUnisonMenuProps {
  lyric: UnisonLyric;
  disabled: boolean;
  onRemove?: () => void;
}

// -- Components ----------------------------------------------------------------

const OnUnisonMenu: React.FC<OnUnisonMenuProps> = ({ lyric, disabled, onRemove }) => {
  const [anchor, setAnchor] = useState<MenuAnchor | null>(null);
  const close = useCallback(() => setAnchor(null), []);

  return (
    <>
      <IconButton
        variant="ghost"
        label="More Unison actions"
        icon={<IconDots aria-hidden="true" className="size-4" />}
        disabled={disabled}
        {...menuTriggerProps(anchor !== null)}
        onClick={(event) => setAnchor(anchor ? null : { kind: "element", element: event.currentTarget })}
        className="ml-auto size-7"
      />
      <Menu
        anchor={anchor}
        align="end"
        onClose={close}
        aria-label="Unison actions"
        className="w-[220px] rounded-[14px]"
      >
        <MenuItem
          icon={IconExternalLink}
          label="View on Unison"
          onSelect={() => window.open(unisonLyricPageUrl(lyric.videoId, lyric.id), "_blank", "noopener,noreferrer")}
        />
        {onRemove && (
          <>
            <MenuSeparator />
            <MenuItem icon={IconTrash} label="Remove from Unison" tone="danger" onSelect={onRemove} />
          </>
        )}
      </Menu>
    </>
  );
};

// -- Exports -------------------------------------------------------------------

export { OnUnisonMenu };
