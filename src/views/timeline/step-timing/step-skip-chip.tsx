import type { LinkGroup } from "@/domain/group/template";
import { instanceKey } from "@/domain/instance/key";
import { instanceName } from "@/domain/instance/name";
import { useProjectStore } from "@/stores/project";
import { Tooltip } from "@/ui/tooltip";
import { BannerTag } from "@/views/timeline/banner-tag";
import { useStepView } from "@/views/timeline/step-timing/step-next";
import { IconPlayerSkipForward } from "@tabler/icons-react";

// -- Interfaces ----------------------------------------------------------------

interface StepSkipChipProps {
  group: LinkGroup;
  instanceIdx: number;
}

// -- Components ----------------------------------------------------------------

const StepSkipChip: React.FC<StepSkipChipProps> = ({ group, instanceIdx }) => {
  const follows = useStepView((view) => view?.follows.get(instanceKey(group.id, instanceIdx)));
  const name = useProjectStore((s) => (follows ? instanceName(s.lines, group, instanceIdx) : ""));
  if (!follows) return null;
  return (
    <Tooltip
      className="min-w-4 shrink-[999]"
      content={`${name} has the same timing as ${follows}, so the keys skip it. Timing ${follows} times this one too. To change it here, click one of its words.`}
    >
      <BannerTag icon={IconPlayerSkipForward}>Skipped · follows {follows}</BannerTag>
    </Tooltip>
  );
};

// -- Exports -------------------------------------------------------------------

export { StepSkipChip };
