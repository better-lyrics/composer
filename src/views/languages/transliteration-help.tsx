import { Button } from "@/ui/button";
import { Popover } from "@/ui/popover";
import { IconInfoCircle } from "@tabler/icons-react";

const TransliterationHelp: React.FC = () => (
  <Popover
    placement="bottom-start"
    trigger={
      <Button size="icon" variant="ghost" aria-label="Transliteration formatting help">
        <IconInfoCircle className="size-4" />
      </Button>
    }
  >
    <div className="w-80 p-4 select-text">
      <p className="mb-2 text-sm font-medium">Transliteration boundaries</p>
      <p className="text-xs leading-5 text-composer-text-secondary">
        Use a dash between syllables in one source word, and a space between source words.
      </p>
      <code className="block p-2 mt-3 text-xs border rounded-md bg-composer-input border-composer-border">
        geol-eum-eun Like a dance
      </code>
      <p className="mt-3 text-xs leading-5 text-composer-text-muted">
        Dashes are not exported or timed. TTML uses one untimed space between syllables and two between words.
      </p>
    </div>
  </Popover>
);

export { TransliterationHelp };
