declare namespace JSX {
  interface IntrinsicElements {
    "braccato-lyrics": React.DetailedHTMLProps<
      React.HTMLAttributes<HTMLElement> & {
        source?: string;
        src?: string;
        playing?: boolean;
        "current-time"?: number;
        "scroll-mode"?: "internal" | "external";
        dir?: "auto" | "ltr" | "rtl";
      },
      HTMLElement
    >;
  }
}
