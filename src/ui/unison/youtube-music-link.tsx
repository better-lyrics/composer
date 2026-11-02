import { cn } from "@/utils/cn";
import { youTubeMusicUrl } from "@/utils/youtube-music-url";
import { IconExternalLink } from "@tabler/icons-react";

// -- Types ---------------------------------------------------------------------

interface YouTubeMusicLinkProps {
  videoId: string;
  label?: string;
  className?: string;
}

// -- Component -----------------------------------------------------------------

const YouTubeMusicLink: React.FC<YouTubeMusicLinkProps> = ({ videoId, label, className }) => {
  const text = label ?? videoId;
  const lastWordAt = text.lastIndexOf(" ") + 1;
  return (
    <a
      href={youTubeMusicUrl(videoId)}
      target="_blank"
      rel="noreferrer noopener"
      className={cn(
        "group/yt self-start rounded-sm leading-[18px] text-composer-text line-clamp-2 wrap-anywhere cursor-pointer hover:underline underline-offset-2 decoration-(--muted) focus-visible:outline-2 focus-visible:outline-composer-accent",
        label ? "text-[13px]" : "font-mono text-xs",
        className,
      )}
    >
      {text.slice(0, lastWordAt)}
      <span className="whitespace-nowrap">
        {text.slice(lastWordAt)}
        <IconExternalLink
          aria-hidden="true"
          className="ml-1 -mt-0.5 inline-block size-3 text-(--muted) group-hover/yt:text-composer-text"
        />
      </span>
      <span className="sr-only"> (opens YouTube Music)</span>
    </a>
  );
};

// -- Exports -------------------------------------------------------------------

export { YouTubeMusicLink };
