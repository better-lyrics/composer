import "react";
import type { BraccatoLyricsElement } from "@braccato/core/element";

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "braccato-lyrics": React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, BraccatoLyricsElement>;
    }
  }
}
