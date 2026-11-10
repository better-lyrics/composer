import type { LinkGroup } from "@/domain/group/template";
import { instanceName } from "@/domain/instance/name";
import { useProjectStore } from "@/stores/project";
import { Tooltip } from "@/ui/tooltip";
import { StepNextContext } from "@/views/timeline/step-timing/step-next";
import { IconPlayerSkipForward } from "@tabler/icons-react";
import { use } from "react";

// -- Interfaces ----------------------------------------------------------------

interface StepSkipChipProps {
  group: LinkGroup;
  instanceIdx: number;
}

// -- Components ----------------------------------------------------------------

const StepSkipChip: React.FC<StepSkipChipProps> = ({ group, instanceIdx }) => {
  const follows = use(StepNextContext)?.follows.get(`${group.id}:${instanceIdx}`);
  const name = useProjectStore((s) => (follows ? instanceName(s.lines, group, instanceIdx) : ""));
  if (!follows) return null;
  return (
    <Tooltip
      content={`${name} has the same timing as ${follows}, so the keys skip it. Timing ${follows} times this one too. To change it here, click one of its words.`}
    >
      <span className="flex min-w-0 items-center gap-0.5 overflow-hidden rounded-full border border-dashed border-composer-text-faint py-px pl-1 pr-1.5 text-composer-text-tertiary whitespace-nowrap">
        <IconPlayerSkipForward className="size-2.5 shrink-0" />
        <span className="truncate">Skipped · follows {follows}</span>
      </span>
    </Tooltip>
  );
};

// -- Exports -------------------------------------------------------------------

export { StepSkipChip };
