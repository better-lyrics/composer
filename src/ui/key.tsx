import { cn } from "@/utils/cn";

// -- Types --------------------------------------------------------------------

type KeySize = "lg" | "md" | "sm";

interface KeyProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  size?: KeySize;
  ref?: React.Ref<HTMLButtonElement>;
}

// -- Constants ----------------------------------------------------------------

const SIZE_STYLES: Record<KeySize, string> = {
  lg: "[--key-height:44px] [--key-depth:4px] [--key-radius:13px]",
  md: "[--key-height:36px]",
  sm: "[--key-height:28px] [--key-depth:2px] [--key-radius:8px]",
};

// -- Component ----------------------------------------------------------------

const Key: React.FC<KeyProps> = ({ size = "md", className, children, type = "button", ...props }) => (
  <button type={type} className={cn("key select-none", SIZE_STYLES[size], className)} {...props}>
    <span className="key-cap">{children}</span>
  </button>
);

// -- Exports ------------------------------------------------------------------

export { Key };
