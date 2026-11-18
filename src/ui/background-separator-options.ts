import type { BackgroundSeparator } from "insync/background-vocal-brackets";

const BACKGROUND_SEPARATOR_OPTIONS: readonly { value: BackgroundSeparator; label: string }[] = [
  { value: "comma", label: "Comma" },
  { value: "space", label: "Space" },
];

export { BACKGROUND_SEPARATOR_OPTIONS };
