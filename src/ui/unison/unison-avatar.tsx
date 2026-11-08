import { cn } from "@/utils/cn";
import { IconUser } from "@tabler/icons-react";
import { useState } from "react";

// -- Types ---------------------------------------------------------------------

type UnisonAvatarSize = "sm" | "md" | "lg";

interface UnisonAvatarProps {
  avatarUrl: string | null;
  size?: UnisonAvatarSize;
  className?: string;
}

// -- Constants -----------------------------------------------------------------

const FRAME_SIZES: Record<UnisonAvatarSize, string> = { sm: "size-6", md: "size-9", lg: "size-12" };
const ICON_SIZES: Record<UnisonAvatarSize, string> = { sm: "size-3.5", md: "size-[18px]", lg: "size-6" };

// -- Component -----------------------------------------------------------------

const UnisonAvatar: React.FC<UnisonAvatarProps> = ({ avatarUrl, size = "sm", className }) => {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const frame = cn("shrink-0 rounded-full", FRAME_SIZES[size], className);
  if (!avatarUrl || failedUrl === avatarUrl) {
    return (
      <span className={cn(frame, "grid place-items-center bg-(--layer-2) text-(--muted)")}>
        <IconUser aria-hidden="true" className={ICON_SIZES[size]} />
      </span>
    );
  }
  return (
    <img
      src={avatarUrl}
      alt=""
      onError={() => setFailedUrl(avatarUrl)}
      className={cn(frame, "object-cover outline-1 -outline-offset-1 outline-(--edge)")}
    />
  );
};

// -- Exports -------------------------------------------------------------------

export { UnisonAvatar };
