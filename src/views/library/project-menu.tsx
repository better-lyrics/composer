import { displayTitle } from "@/domain/project/display-title";
import type { ProjectIndexEntry } from "@/domain/project/index-entry";
import { getEffectiveKeysArray, useShortcutBindingsStore } from "@/stores/shortcut-bindings";
import { InlineKeyBadge } from "@/ui/inline-key-badge";
import { Menu, type MenuAnchor, MenuItem, MenuSeparator } from "@/ui/menu";
import { formatShortcut } from "@/utils/format-key";
import { IconArrowUpRight, IconCopy, IconDownload, IconPencil, IconTrash } from "@tabler/icons-react";

// -- Types --------------------------------------------------------------------

interface ProjectMenuProps {
  project: ProjectIndexEntry;
  anchor: MenuAnchor;
  onClose: () => void;
  onOpen: (id: string) => void;
  onRename: (project: ProjectIndexEntry) => void;
  onDuplicate: (id: string) => void;
  onExport: (id: string) => void;
  onDelete: (project: ProjectIndexEntry) => void;
}

// -- Constants ----------------------------------------------------------------

const DELETE_SHORTCUT_ID = "library.deleteSelection";

// -- Component ----------------------------------------------------------------

const ProjectMenu: React.FC<ProjectMenuProps> = ({
  project,
  anchor,
  onClose,
  onOpen,
  onRename,
  onDuplicate,
  onExport,
  onDelete,
}) => {
  const deleteShortcut = useShortcutBindingsStore(() => formatShortcut(getEffectiveKeysArray(DELETE_SHORTCUT_ID)));

  return (
    <Menu anchor={anchor} onClose={onClose} aria-label={`Actions for ${displayTitle(project.title)}`}>
      <MenuItem icon={IconArrowUpRight} label="Open" onSelect={() => onOpen(project.id)} />
      <MenuItem icon={IconPencil} label="Rename" onSelect={() => onRename(project)} />
      <MenuItem icon={IconCopy} label="Duplicate" onSelect={() => onDuplicate(project.id)} />
      <MenuItem icon={IconDownload} label="Export project file" onSelect={() => onExport(project.id)} />
      <MenuSeparator />
      <MenuItem
        icon={IconTrash}
        label="Delete"
        tone="danger"
        onSelect={() => onDelete(project)}
        trail={deleteShortcut ? <InlineKeyBadge text={deleteShortcut} /> : undefined}
      />
    </Menu>
  );
};

// -- Exports ------------------------------------------------------------------

export { ProjectMenu };
