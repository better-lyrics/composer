declare module "kuroshiro-browser" {
  type RomajiSystem = "hepburn" | "nippon" | "passport";

  interface ConvertOptions {
    to?: "hiragana" | "katakana" | "romaji";
    mode?: "normal" | "spaced" | "okurigana" | "furigana";
    romajiSystem?: RomajiSystem;
    delimiter_start?: string;
    delimiter_end?: string;
  }

  interface KuroshiroInstance {
    convert(text: string, options?: ConvertOptions): Promise<string>;
    getFurigana(text: string): Promise<string>;
  }

  class Kuroshiro implements KuroshiroInstance {
    convert(text: string, options?: ConvertOptions): Promise<string>;
    getFurigana(text: string): Promise<string>;
    static buildAndInitWithKuromoji(isProd: boolean): Promise<Kuroshiro>;
  }

  export { Kuroshiro };
  export type { ConvertOptions, KuroshiroInstance, RomajiSystem };
}
