import type { StemOrigin, StemSlot } from "@/domain/stems/stem-slot";
import { useConfirm } from "@/stores/confirm-store";
import { useSeparationStore } from "@/stores/separation";
import { IconButton } from "@/ui/icon-button";
import { KEEPS_POPOVERS_OPEN_PROPS } from "@/ui/keeps-popovers-open";
import { Menu, type MenuAnchor, MenuItem, MenuSeparator } from "@/ui/menu";
import { menuTriggerProps } from "@/ui/menu-trigger-props";
import { STEM_LABELS } from "@/ui/stem-labels";
import { formatFileSize } from "@/utils/format-file-size";
import { formatTime } from "@/utils/format-time";
import { IconDots, IconReplace, IconTrash, IconUpload } from "@tabler/icons-react";
import { useState } from "react";

// -- Types --------------------------------------------------------------------

interface StemRowMenuProps {
  slot: StemSlot;
  origin: StemOrigin;
  onImportFile: (slot: StemSlot) => void;
}

// -- Components ---------------------------------------------------------------

const MenuHeader: React.FC<{ title: string; detail: string }> = ({ title, detail }) => (
  <>
    <div className="px-2 pt-1.5 pb-2">
      <p className="text-[12.5px] font-medium text-composer-text wrap-anywhere select-text">{title}</p>
      <p className="mt-0.5 text-xs tabular-nums text-(--muted) select-text">{detail}</p>
    </div>
    <MenuSeparator />
  </>
);

const StemRowMenu: React.FC<StemRowMenuProps> = ({ slot, origin, onImportFile }) => {
  const [anchor, setAnchor] = useState<MenuAnchor | null>(null);
  const details = useSeparationStore((s) => s.stemDetails[slot]);
  const confirm = useConfirm();
  const label = STEM_LABELS[slot];
  const lowerLabel = label.toLowerCase();

  const toggleMenu = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (anchor) {
      setAnchor(null);
      return;
    }
    setAnchor({ kind: "element", element: event.currentTarget });
  };

  const confirmRemove = async () => {
    const confirmed = await confirm({
      title: `Remove imported ${lowerLabel}?`,
      description: details ? (
        <>This deletes “{details.name}” from the project. To use it again, import the file again.</>
      ) : (
        "This deletes the file from the project. To use it again, import the file again."
      ),
      confirmLabel: `Remove ${lowerLabel}`,
      variant: "destructive",
    });
    if (confirmed) await useSeparationStore.getState().removeImportedStem(slot);
  };

  return (
    <>
      <IconButton
        label={`${label} stem options`}
        icon={<IconDots aria-hidden="true" className="size-4" />}
        variant="ghost"
        {...menuTriggerProps(anchor !== null)}
        onClick={toggleMenu}
        className="size-7 shrink-0 mr-[3px] rounded-md text-(--muted) transition-colors duration-150 motion-reduce:transition-none hover:bg-(--layer-3) hover:text-composer-text aria-expanded:bg-(--layer-3) aria-expanded:text-composer-text"
      />
      <Menu anchor={anchor} onClose={() => setAnchor(null)} aria-label={`${label} stem`}>
        <div {...KEEPS_POPOVERS_OPEN_PROPS} className="contents">
          {origin === "imported" ? (
            <>
              {details && (
                <MenuHeader
                  title={details.name}
                  detail={`${formatTime(details.durationSeconds, 2)} ・ ${formatFileSize(details.bytes)}`}
                />
              )}
              <MenuItem icon={IconReplace} label="Replace file…" onSelect={() => onImportFile(slot)} />
              <MenuItem
                icon={IconTrash}
                label={`Remove ${lowerLabel}`}
                tone="danger"
                onSelect={() => void confirmRemove()}
              />
            </>
          ) : (
            <>
              <MenuHeader title={`Separated ${lowerLabel}`} detail="Made by the vocal model" />
              <MenuItem icon={IconUpload} label="Import a file instead…" onSelect={() => onImportFile(slot)} />
            </>
          )}
        </div>
      </Menu>
    </>
  );
};

// -- Exports ------------------------------------------------------------------

export { StemRowMenu };
