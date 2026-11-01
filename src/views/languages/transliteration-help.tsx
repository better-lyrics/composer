import { IconButton } from "@/ui/icon-button";
import { Popover } from "@/ui/popover";
import { IconInfoCircle } from "@tabler/icons-react";

// -- Component ----------------------------------------------------------------

const TransliterationHelp: React.FC = () => (
  <Popover
    placement="bottom-start"
    trigger={
      <IconButton
        label="Transliteration formatting help"
        icon={<IconInfoCircle className="size-[13px]" />}
        variant="ghost"
        className="size-5 rounded-md"
      />
    }
  >
    <div className="flex w-72 flex-col gap-2 p-3.5 text-[12.5px] leading-[1.55] text-(--label) select-text">
      <p className="text-[13.5px] font-bold text-composer-text">Spacing in transliterations</p>
      <p className="text-pretty">One space is a pronunciation break. Two spaces are a word break.</p>
      <code className="block px-2.5 py-2 font-mono text-xs font-medium leading-normal text-composer-text border rounded-lg bg-(--well) border-(--edge)">
        geol eum eun&nbsp;&nbsp;Like&nbsp;&nbsp;a&nbsp;&nbsp;dance
      </code>
      <p className="text-(--muted) text-pretty">
        Spaces show but aren't timed. Dashes stay as text. Set timing with Align.
      </p>
    </div>
  </Popover>
);

// -- Exports ------------------------------------------------------------------

export { TransliterationHelp };
