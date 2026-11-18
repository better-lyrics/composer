import { useSettingsStore } from "@/stores/settings";
import { Button, type ButtonProps } from "@/ui/button";
import { LazyPopover } from "@/ui/lazy-popover";
import { Popover } from "@/ui/popover";
import { cn } from "@/utils/cn";
import { BracketsSettings } from "@/views/edit/brackets-settings";
import { linesKeepingBracketsAsText } from "@/views/edit/brackets-status";
import type { ParsedLine } from "@/views/edit/parse-lyrics";
import { useMemo } from "react";
import { IconChevronDown, IconParentheses } from "@tabler/icons-react";

// -- Interfaces ----------------------------------------------------------------

interface BracketsPopoverProps {
  extractableCount: number;
  parsed: readonly ParsedLine[];
  onExtract: () => void;
}

// -- Components ----------------------------------------------------------------

// Takes the open state, ref and handlers LazyPopover gives its trigger.
const BracketsTrigger: React.FC<ButtonProps> = (props) => {
  const auto = useSettingsStore((s) => s.autoExtractBackgroundVocals);
  return (
    <Button
      {...props}
      variant="ghost"
      size="sm"
      className="group relative gap-0 pl-[7px] pr-1.5 text-(--label) hover:text-(--label) whitespace-nowrap aria-expanded:bg-(--layer-2) motion-reduce:active:scale-100 after:absolute after:inset-x-0 after:-inset-y-1.5"
    >
      <IconParentheses
        aria-hidden="true"
        className={cn("size-4 mr-[5px] transition-colors", auto ? "text-composer-accent-text" : "text-(--muted)")}
      />
      <span className="mr-[7px]">Brackets</span>
      <span className={cn("text-[12.5px]", auto ? "text-composer-accent-text" : "text-(--muted)")}>
        {auto ? "Auto" : "Manual"}
      </span>
      <IconChevronDown
        aria-hidden="true"
        className="size-[13px] ml-1 text-(--muted) transition-[rotate,color] duration-150 group-aria-expanded:rotate-180 group-aria-expanded:text-composer-text motion-reduce:transition-none"
      />
    </Button>
  );
};

const BracketsPopover: React.FC<BracketsPopoverProps> = ({ extractableCount, parsed, onExtract }) => {
  const keptAsTextCount = useMemo(() => linesKeepingBracketsAsText(parsed).length, [parsed]);
  return (
    <LazyPopover hasPopup="dialog" trigger={<BracketsTrigger />}>
      {(anchor) => (
        <Popover placement="bottom-end" aria-label="Brackets" {...anchor}>
          <BracketsSettings
            extractableCount={extractableCount}
            keptAsTextCount={keptAsTextCount}
            onExtract={onExtract}
          />
        </Popover>
      )}
    </LazyPopover>
  );
};

// -- Exports -------------------------------------------------------------------

export { BracketsPopover };
