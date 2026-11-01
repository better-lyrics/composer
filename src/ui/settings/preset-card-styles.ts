// -- Constants -----------------------------------------------------------------

const CARD_BASE =
  "relative flex flex-col items-start text-left rounded-xl px-2.5 pt-2.5 pb-3 cursor-pointer transition-[background-color,box-shadow] select-none";

const CARD_INACTIVE = "bg-transparent shadow-[inset_0_0_0_1px_var(--edge)] hover:bg-(--layer-1)";

const CARD_ACTIVE = "btn-raised [&_[data-card-description]]:text-(--label)";

const CARD_GROUP_LABEL = "text-xs font-semibold text-(--muted) select-none";

const HEADER_ACTION_BUTTON = "h-6 pl-1.5 pr-2 text-xs rounded-md";

// -- Exports -------------------------------------------------------------------

export { CARD_ACTIVE, CARD_BASE, CARD_GROUP_LABEL, CARD_INACTIVE, HEADER_ACTION_BUTTON };
