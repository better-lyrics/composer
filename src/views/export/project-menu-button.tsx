import { useProjectFileActions } from "@/hooks/useProjectFileActions";
import { PROJECT_FILE_ACCEPT } from "@/lib/project-file-read";
import { Button } from "@/ui/button";
import { Menu, type MenuAnchor, MenuItem, MenuSeparator } from "@/ui/menu";
import { menuTriggerProps } from "@/ui/menu-trigger-props";
import { IconChevronDown, IconFolder, IconFolderOpen, IconTrash, IconUpload } from "@tabler/icons-react";
import { useMemo, useRef, useState } from "react";

// -- Hooks --------------------------------------------------------------------

// The hidden project file picker, mounted wherever an "Import project" action can run.
function useProjectFileInput() {
  const inputRef = useRef<HTMLInputElement>(null);
  const { handleImportProject } = useProjectFileActions();
  const input = (
    <input
      ref={inputRef}
      type="file"
      aria-label="Import project file"
      accept={PROJECT_FILE_ACCEPT}
      onChange={handleImportProject}
      className="hidden"
    />
  );
  return { input, pickFile: () => inputRef.current?.click() };
}

// -- Components ---------------------------------------------------------------

const ProjectMenuButton: React.FC = () => {
  const [trigger, setTrigger] = useState<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const anchor = useMemo<MenuAnchor | null>(
    () => (open && trigger ? { kind: "element", element: trigger } : null),
    [open, trigger],
  );
  const { input, pickFile } = useProjectFileInput();
  const { handleExportProject, handleClearProject } = useProjectFileActions();

  return (
    <>
      {input}
      <Button
        ref={setTrigger}
        variant="ghost"
        size="lg"
        hasIcon
        {...menuTriggerProps(open)}
        onClick={() => setOpen((shown) => !shown)}
        className="pr-[5px] aria-expanded:bg-(--layer-3) aria-expanded:text-composer-text"
      >
        <IconFolder className="size-4" />
        Project
        <IconChevronDown className="size-3.5 opacity-50 transition-[rotate,opacity] in-aria-expanded:rotate-180 in-aria-expanded:opacity-90" />
      </Button>
      {trigger && (
        <Menu
          anchor={anchor}
          align="start"
          aria-label="Project"
          onClose={() => setOpen(false)}
          className="w-auto min-w-[200px] rounded-[14px]"
        >
          <MenuItem icon={IconFolderOpen} label="Import project" onSelect={pickFile} />
          <MenuItem icon={IconUpload} label="Export project" onSelect={handleExportProject} />
          <MenuSeparator />
          <MenuItem icon={IconTrash} label="Clear project" tone="danger" onSelect={handleClearProject} />
        </Menu>
      )}
    </>
  );
};

// -- Exports ------------------------------------------------------------------

export { ProjectMenuButton, useProjectFileInput };
