declare module "kuroshiro" {
  type RomajiSystem = "hepburn" | "nippon" | "passport";

  interface ConvertOptions {
    to?: "hiragana" | "katakana" | "romaji";
    mode?: "normal" | "spaced" | "okurigana" | "furigana";
    romajiSystem?: RomajiSystem;
    delimiter_start?: string;
    delimiter_end?: string;
  }

  interface KuroshiroAnalyzer {
    init(): Promise<void>;
    parse(text: string): Promise<unknown[]>;
  }

  class Kuroshiro {
    init(analyzer: KuroshiroAnalyzer): Promise<void>;
    convert(text: string, options?: ConvertOptions): Promise<string>;
  }

  export default Kuroshiro;
  export type { ConvertOptions, KuroshiroAnalyzer, RomajiSystem };
}

declare module "kuroshiro-analyzer-kuromoji" {
  interface AnalyzerOptions {
    dictPath?: string;
  }

  class KuromojiAnalyzer {
    constructor(options?: AnalyzerOptions);
    init(): Promise<void>;
    parse(text: string): Promise<unknown[]>;
  }

  export default KuromojiAnalyzer;
  export type { AnalyzerOptions };
}
