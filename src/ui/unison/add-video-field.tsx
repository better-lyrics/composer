import { Button } from "@/ui/button";
import { IconField } from "@/ui/icon-field";
import { FLOATING_INPUT_STYLES } from "@/ui/input-styles";
import { cn } from "@/utils/cn";
import { extractVideoId } from "@/utils/youtube-url";
import { IconLink } from "@tabler/icons-react";
import { useId, useState } from "react";

// -- Interfaces ----------------------------------------------------------------

interface AddVideoFieldProps {
  onAdd: (videoId: string) => Promise<string | null> | string | null;
  placeholder?: string;
  disabledReason?: string | null;
  floating?: boolean;
  /** Another video write is running; adding waits for it. */
  busy?: boolean;
}

// -- Constants -----------------------------------------------------------------

const INVALID_LINK_MESSAGE = "That isn't a YouTube link or video id. Paste a link like youtube.com/watch?v=…";
const MESSAGE_STYLES = "px-0.5 text-xs leading-[18px] text-pretty select-text cursor-text";

// -- Component -----------------------------------------------------------------

const AddVideoField: React.FC<AddVideoFieldProps> = ({
  onAdd,
  placeholder = "Paste another YouTube link",
  disabledReason,
  floating,
  busy = false,
}) => {
  const [link, setLink] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const messageId = useId();
  const disabled = Boolean(disabledReason);
  const message = disabledReason ?? error;

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (adding || busy) return;
    const videoId = extractVideoId(link);
    if (!videoId) {
      setError(INVALID_LINK_MESSAGE);
      return;
    }
    setAdding(true);
    const failure = await onAdd(videoId);
    setAdding(false);
    setError(failure);
    if (!failure) setLink("");
  };

  return (
    <form className="flex flex-col gap-2" aria-busy={adding} onSubmit={(event) => void submit(event)}>
      <div className="flex gap-2">
        <IconField
          icon={IconLink}
          aria-label="YouTube link to add"
          aria-invalid={error !== null && !disabled}
          aria-describedby={message ? messageId : undefined}
          placeholder={placeholder}
          value={link}
          disabled={disabled}
          onChange={(event) => {
            setLink(event.target.value);
            setError(null);
          }}
          wrapperClassName="flex-1 min-w-0"
          className={cn(floating && FLOATING_INPUT_STYLES, "h-8 pl-8 pr-3 rounded-lg text-[13px]")}
        />
        <Button type="submit" size="md" variant="secondary" disabled={disabled || adding || busy || link.trim() === ""}>
          Add
        </Button>
      </div>
      {disabledReason && (
        <p id={messageId} className={cn(MESSAGE_STYLES, "text-(--muted)")}>
          {disabledReason}
        </p>
      )}
      {!disabledReason && error && (
        <p id={messageId} role="alert" className={cn(MESSAGE_STYLES, "text-composer-negative")}>
          {error}
        </p>
      )}
    </form>
  );
};

// -- Exports -------------------------------------------------------------------

export { AddVideoField };
