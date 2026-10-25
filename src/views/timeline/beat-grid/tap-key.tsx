import { Key } from "@/ui/key";
import { cn } from "@/utils/cn";
import { IconHandFinger } from "@tabler/icons-react";

// -- Components ----------------------------------------------------------------

const TapKey: React.FC<{ onTap: () => void; className?: string }> = ({ onTap, className }) => (
  <Key size="lg" onClick={onTap} className={cn("tap-key [--key-height:52px]", className)}>
    <IconHandFinger aria-hidden="true" className="block size-[18px] text-composer-accent-text" />
    <span className="[text-box:trim-both_cap_alphabetic]">Tap</span>
  </Key>
);

// -- Exports -------------------------------------------------------------------

export { TapKey };
