import { displayArtists, displayTitle, hasArtists } from "@/domain/project/display-title";
import { useProjectStore } from "@/stores/project";
import { getEffectiveKeysArray, useShortcutBindingsStore } from "@/stores/shortcut-bindings";
import { useUIStore } from "@/stores/ui";
import { Button } from "@/ui/button";
import { LinkButton } from "@/ui/link-button";
import { Popover } from "@/ui/popover";
import { ProjectArt } from "@/ui/projects/project-art";
import { ProjectSwitcher } from "@/ui/projects/project-switcher";
import { SaveStatusAnnouncer, SaveStatusGlyph } from "@/ui/projects/save-status-label";
import { LIBRARY_PATH } from "@/utils/app-routes";
import { formatShortcut } from "@/utils/format-key";
import { IconChevronDown, IconChevronRight } from "@tabler/icons-react";

// -- Constants ----------------------------------------------------------------

const SWITCHER_SHORTCUT_ID = "global.openProjectSwitcher";

// -- Component ----------------------------------------------------------------

const ProjectBreadcrumb: React.FC = () => {
  const title = useProjectStore((state) => state.metadata.title);
  const thumbnail = useProjectStore((state) => state.metadata.thumbnailDataUrl);
  const artists = useProjectStore((state) => state.metadata.artists);
  const isOpen = useUIStore((state) => state.projectSwitcherOpen);
  const setOpen = useUIStore((state) => state.setProjectSwitcherOpen);
  const shownTitle = displayTitle(title);
  const switchKeys = useShortcutBindingsStore(() => formatShortcut(getEffectiveKeysArray(SWITCHER_SHORTCUT_ID)));
  const switchTitle = switchKeys ? `Switch project (${switchKeys})` : "Switch project";

  return (
    <div className="flex items-center min-w-0 select-none">
      <nav aria-label="Project" className="flex items-center gap-3 min-w-0">
        <LinkButton to={LIBRARY_PATH} variant="ghost" className="-ml-1 px-2 text-[13.5px] hover:text-composer-text">
          Projects
        </LinkButton>
        <IconChevronRight aria-hidden="true" className="-ml-1.5 -mr-2 size-3.5 shrink-0 text-composer-text-faint" />
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
              className="group gap-2.5 h-10 max-w-[380px] min-w-0 pl-[5px] pr-3 py-0 rounded-xl text-composer-text hover:text-composer-text aria-expanded:bg-(--layer-1)"
            >
              <ProjectArt src={thumbnail} size="sm" />
              <span className="flex flex-col min-w-0 leading-[1.15] text-left">
                <span className="flex items-center gap-1.5 min-w-0 text-sm font-bold">
                  <span className="truncate">{shownTitle}</span>
                  <SaveStatusGlyph />
                </span>
                {hasArtists(artists) && (
                  <span className="truncate text-xs font-normal text-(--muted)">{displayArtists(artists)}</span>
                )}
              </span>
              <IconChevronDown
                aria-hidden="true"
                className="size-[15px] shrink-0 text-(--muted) transition-[rotate] duration-150 motion-reduce:transition-none group-aria-expanded:rotate-180"
              />
            </Button>
          }
        >
          {(close) => <ProjectSwitcher onClose={close} />}
        </Popover>
      </nav>
      <SaveStatusAnnouncer />
    </div>
  );
};

// -- Exports ------------------------------------------------------------------

export { ProjectBreadcrumb };
