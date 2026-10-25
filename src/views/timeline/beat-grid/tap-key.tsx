import { useSettingsStore } from "@/stores/settings";
import { getEffectiveKeysArray } from "@/stores/shortcut-bindings";
import { InlineKeyBadge } from "@/ui/inline-key-badge";
import { Key } from "@/ui/key";
import { cn } from "@/utils/cn";
import { focusOnMount } from "@/utils/focus-on-mount";
import { IconHandFinger } from "@tabler/icons-react";

// -- Interfaces ----------------------------------------------------------------

interface TapKeyProps {
  onTap: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLButtonElement>) => void;
  className?: string;
}

// -- Components ----------------------------------------------------------------

const TapKey: React.FC<TapKeyProps> = ({ onTap, onKeyDown, className }) => {
  const showHints = useSettingsStore((s) => s.showShortcutHints);
  return (
    <Key
      ref={focusOnMount}
      size="lg"
      onClick={onTap}
      onKeyDown={onKeyDown}
      className={cn("tap-key [--key-height:52px]", className)}
    >
      {!showHints && <IconHandFinger aria-hidden="true" className="block size-[18px] text-composer-accent-text" />}
      <span className="[text-box:trim-both_cap_alphabetic]">Tap</span>
      {showHints && <InlineKeyBadge keys={getEffectiveKeysArray("sync.tap")} />}
    </Key>
  );
};

// -- Exports -------------------------------------------------------------------

export { TapKey };
