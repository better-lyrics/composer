// @braccato/core 2 ships its custom element as plain JavaScript, with no declarations.
declare module "@braccato/core/element" {
  import type { Lyric, LyricsRenderer, TickOptions, WasmSource } from "@braccato/core";

  type BraccatoRustRenderer = NonNullable<LyricsRenderer["renderer"]>;

  interface LyricsElementOptions {
    noLyrics?: boolean;
    language?: string | null;
    songwriters?: readonly string[];
    songKey?: string;
  }

  interface LineClickDetail {
    timeS: number;
  }

  interface ScrollStateDetail {
    userScrolling: boolean;
  }

  interface ErrorDetail {
    phase: "connect" | "lyrics" | "source";
    error: unknown;
  }

  class BraccatoLyricsElement extends HTMLElement {
    lyrics: Lyric[] | null;
    lyricsOptions: LyricsElementOptions;
    source: HTMLMediaElement | string | null;
    readonly mediaElement: HTMLMediaElement | null;
    currentTime: number;
    playing: boolean;
    tickOptions: Pick<
      TickOptions,
      "lyricOffset" | "globalLyricOffset" | "richsyncOffsetTrim" | "lineOffsetTrim" | "playbackRate" | "smoothScroll" | "passiveScrollEnabled"
    >;
    theme: string;
    host: { getScrollElement?: () => HTMLElement | null };
    layout: "scroll" | "stage";
    decorations: { translations: boolean; romanizations: boolean };
    readonly renderer: BraccatoRustRenderer | null;
    readonly status: "rendering" | "idle";
    resumeAutoscroll(): void;
    relayout(): void;
  }

  function load(source?: WasmSource): Promise<void>;
  function defineLyricsElement(tag?: string): CustomElementConstructor;

  export { BraccatoLyricsElement, defineLyricsElement, load };
  export type { BraccatoRustRenderer, ErrorDetail, LineClickDetail, ScrollStateDetail };
}
