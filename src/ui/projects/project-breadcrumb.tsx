import { displayTitle } from "@/domain/project/display-title";
import { useProjectStore } from "@/stores/project";
import { getEffectiveKeysArray, useShortcutBindingsStore } from "@/stores/shortcut-bindings";
import { useUIStore } from "@/stores/ui";
import { Button } from "@/ui/button";
import { LinkButton } from "@/ui/link-button";
import { Popover } from "@/ui/popover";
import { ProjectArt } from "@/ui/projects/project-art";
import { ProjectSwitcher } from "@/ui/projects/project-switcher";
import { SaveStatusLabel } from "@/ui/projects/save-status-label";
import { LIBRARY_PATH } from "@/utils/app-routes";
import { formatShortcut } from "@/utils/format-key";
import { IconChevronDown, IconChevronRight } from "@tabler/icons-react";

// -- Constants ----------------------------------------------------------------

const SWITCHER_SHORTCUT_ID = "global.openProjectSwitcher";

// -- Component ----------------------------------------------------------------

const ProjectBreadcrumb: React.FC = () => {
  const title = useProjectStore((state) => state.metadata.title);
  const thumbnail = useProjectStore((state) => state.metadata.thumbnailDataUrl);
  const isOpen = useUIStore((state) => state.projectSwitcherOpen);
  const setOpen = useUIStore((state) => state.setProjectSwitcherOpen);
  const shownTitle = displayTitle(title);
  const switchKeys = useShortcutBindingsStore(() => formatShortcut(getEffectiveKeysArray(SWITCHER_SHORTCUT_ID)));
  const switchTitle = switchKeys ? `Switch project (${switchKeys})` : "Switch project";

  return (
    <div className="flex items-center gap-0.5 min-w-0 select-none">
      <nav aria-label="Project" className="flex items-center gap-0.5 min-w-0">
        <LinkButton to={LIBRARY_PATH} variant="ghost" className="px-2 text-[15px]">
          Projects
        </LinkButton>
        <IconChevronRight aria-hidden="true" className="size-4 shrink-0 text-composer-text-faint" />
        <Popover
          open={isOpen}
          onOpenChange={setOpen}
          placement="bottom-start"
          aria-label="Switch project"
          trigger={
            <Button
              variant="ghost"
              aria-label={`${shownTitle}, switch project`}
              title={switchTitle}
              className="group gap-2 h-8 max-w-[380px] min-w-0 px-1.5 py-0 rounded-[10px] text-[15px] leading-[22px] font-bold text-composer-text hover:text-composer-text aria-expanded:bg-composer-button"
            >
              <ProjectArt src={thumbnail} size="sm" />
              <span className="truncate">{shownTitle}</span>
              <IconChevronDown
                aria-hidden="true"
                className="size-4 shrink-0 text-composer-text opacity-50 transition-[rotate] duration-150 motion-reduce:transition-none group-aria-expanded:rotate-180"
              />
            </Button>
          }
        >
          {(close) => <ProjectSwitcher onClose={close} />}
        </Popover>
      </nav>
      <SaveStatusLabel />
    </div>
  );
};

// -- Exports ------------------------------------------------------------------

export { ProjectBreadcrumb };
