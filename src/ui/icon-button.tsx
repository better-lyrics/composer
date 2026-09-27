import { Button, type ButtonProps } from "@/ui/button";

// -- Types --------------------------------------------------------------------

interface IconButtonProps extends Omit<ButtonProps, "size" | "children"> {
  label: string;
  icon: React.ReactNode;
}

// -- Component ----------------------------------------------------------------

const IconButton: React.FC<IconButtonProps> = ({ label, icon, ...props }) => (
  <Button size="icon" aria-label={label} title={label} {...props}>
    {icon}
  </Button>
);

// -- Exports ------------------------------------------------------------------

export { IconButton };
