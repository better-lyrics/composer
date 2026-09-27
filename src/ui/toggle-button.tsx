import { Button, type ButtonProps } from "@/ui/button";
import { cn } from "@/utils/cn";

// -- Types --------------------------------------------------------------------

interface ToggleButtonProps extends Omit<ButtonProps, "variant"> {
  pressed: boolean;
}

// -- Component ----------------------------------------------------------------

const ToggleButton: React.FC<ToggleButtonProps> = ({ pressed, className, ...props }) => (
  <Button
    variant={pressed ? "primary" : "ghost"}
    aria-pressed={pressed}
    className={cn(!pressed && "opacity-60", className)}
    {...props}
  />
);

// -- Exports ------------------------------------------------------------------

export { ToggleButton };
