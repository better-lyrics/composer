import type { Icon } from "@tabler/icons-react";

// -- Interfaces ----------------------------------------------------------------

interface BannerTagProps {
  icon: Icon;
  children: React.ReactNode;
}

// -- Components ----------------------------------------------------------------

// Full-strength text: anything fainter fails 4.5:1 on some group colours in dark themes. Weight and the icon set it apart.
const BannerTag: React.FC<BannerTagProps> = ({ icon: TagIcon, children }) => (
  <span className="flex min-w-3 shrink-[999] overflow-hidden items-center gap-1 ml-1 text-[11px] font-medium text-composer-text whitespace-nowrap">
    <TagIcon aria-hidden="true" stroke={1.75} className="size-3 shrink-0" />
    <span className="truncate">{children}</span>
  </span>
);

// -- Exports -------------------------------------------------------------------

export { BannerTag };
