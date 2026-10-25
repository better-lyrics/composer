import type { StemOrigin, StemSlot } from "@/domain/stems/stem-slot";
import { openProjectIdSnapshot } from "@/lib/open-project-session";
import { loadProjectStems } from "@/lib/project-stems";
import { useConfirm } from "@/stores/confirm-store";
import { useSeparationStore } from "@/stores/separation";
import { IconButton } from "@/ui/icon-button";
import { Menu, type MenuAnchor, MenuItem, MenuSeparator } from "@/ui/menu";
import { menuTriggerProps } from "@/ui/menu-trigger-props";
import { STEM_LABELS } from "@/ui/stem-labels";
import { formatFileSize } from "@/utils/format-file-size";
import { formatTime } from "@/utils/format-time";
import { IconDots, IconReplace, IconTrash, IconUpload } from "@tabler/icons-react";
import { useRef, useState } from "react";

// -- Types --------------------------------------------------------------------

interface StemRowMenuProps {
  slot: StemSlot;
  origin: StemOrigin;
  onImportFile: (slot: StemSlot) => void;
}

interface ImportedStemDetails {
  name: string;
  durationSeconds: number;
  bytes: number;
}

// -- Constants ----------------------------------------------------------------

const LOG_PREFIX = "[StemRowMenu]";

// -- Helpers ------------------------------------------------------------------

async function loadImportedStemDetails(slot: StemSlot): Promise<ImportedStemDetails | null> {
  const projectId = openProjectIdSnapshot();
  if (!projectId) return null;
  try {
    const stem = (await loadProjectStems(projectId))?.slots[slot];
    return stem ? { name: stem.name, durationSeconds: stem.durationSeconds, bytes: stem.data.byteLength } : null;
  } catch (error) {
    console.error(LOG_PREFIX, "could not read the imported stem", error);
    return null;
  }
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
  const [details, setDetails] = useState<ImportedStemDetails | null>(null);
  const detailsRequestRef = useRef<Promise<ImportedStemDetails | null>>(Promise.resolve(null));
  const label = STEM_LABELS[slot];
  const lowerLabel = label.toLowerCase();

  const toggleMenu = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (anchor) {
      setAnchor(null);
      return;
    }
    setAnchor({ kind: "element", element: event.currentTarget });
    if (origin !== "imported") return;
    const request = loadImportedStemDetails(slot);
    detailsRequestRef.current = request;
    setDetails(null);
    void request.then((loaded) => {
      if (detailsRequestRef.current === request) setDetails(loaded);
    });
  };

  const confirmRemove = async () => {
    const loaded = await detailsRequestRef.current;
    const confirmed = await useConfirm()({
      title: `Remove imported ${lowerLabel}?`,
      description: loaded ? (
        <>This deletes “{loaded.name}” from the project. To use it again, import the file again.</>
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
      </Menu>
    </>
  );
};

// -- Exports ------------------------------------------------------------------

export { StemRowMenu };
