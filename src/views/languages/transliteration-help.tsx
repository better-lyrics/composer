import { Button } from "@/ui/button";
import { Popover } from "@/ui/popover";
import { IconInfoCircle } from "@tabler/icons-react";

// -- Component ----------------------------------------------------------------

const TransliterationHelp: React.FC = () => (
  <Popover
    placement="bottom-start"
    trigger={
      <Button size="icon" variant="ghost" aria-label="Transliteration formatting help" className="size-5 rounded-md">
        <IconInfoCircle className="size-3.5" />
      </Button>
    }
  >
    <div className="w-72 p-3 select-text">
      <p className="mb-1.5 text-sm font-medium">Spacing in transliterations</p>
      <p className="text-xs leading-5 text-composer-text-secondary text-pretty">
        One space is a pronunciation break. Two spaces are a word break.
      </p>
      <code className="block p-2 mt-2 font-mono text-xs border rounded-md bg-composer-input border-composer-border">
        geol eum eun&nbsp;&nbsp;Like&nbsp;&nbsp;a&nbsp;&nbsp;dance
      </code>
      <p className="mt-2 text-xs leading-5 text-composer-text-muted text-pretty">
        Spaces show but aren't timed. Dashes stay as text. Set timing with Align.
      </p>
    </div>
  </Popover>
);

// -- Exports ------------------------------------------------------------------

export { TransliterationHelp };
