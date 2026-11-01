import { displayTitle } from "@/domain/project/display-title";
import type { ProjectIndexEntry } from "@/domain/project/index-entry";
import { getEffectiveKeysArray, useShortcutBindingsStore } from "@/stores/shortcut-bindings";
import { Menu, type MenuAnchor, MenuItem, MenuSeparator } from "@/ui/menu";
import { IconArrowUpRight, IconCopy, IconDownload, IconPencil, IconTrash } from "@tabler/icons-react";
import { useShallow } from "zustand/react/shallow";

// -- Types --------------------------------------------------------------------

interface ProjectMenuProps {
  project: ProjectIndexEntry;
  anchor: MenuAnchor | null;
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
  const deleteKeys = useShortcutBindingsStore(useShallow(() => getEffectiveKeysArray(DELETE_SHORTCUT_ID)));

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
        shortcut={deleteKeys}
      />
    </Menu>
  );
};

// -- Exports ------------------------------------------------------------------

export { ProjectMenu };
