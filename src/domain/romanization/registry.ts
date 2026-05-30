import type { WordTiming } from "@/domain/word/timing";

// -- Types --------------------------------------------------------------------

interface RomanizationGenerator {
  scheme: string;
  generateLine(text: string): Promise<string>;
  generateWords(words: WordTiming[]): Promise<WordTiming[]>;
}

type GeneratorFactory = () => Promise<RomanizationGenerator>;

// -- Registry -----------------------------------------------------------------

const FACTORIES = new Map<string, GeneratorFactory>();

// -- Public API ---------------------------------------------------------------

function registerGeneratorFactory(scheme: string, factory: GeneratorFactory): void {
  FACTORIES.set(scheme, factory);
}

function getGeneratorFactory(scheme: string): GeneratorFactory | undefined {
  return FACTORIES.get(scheme);
}

function clearGeneratorRegistry(): void {
  FACTORIES.clear();
}

function snapshotGeneratorRegistry(): ReadonlyMap<string, GeneratorFactory> {
  return new Map(FACTORIES);
}

function restoreGeneratorRegistry(snapshot: ReadonlyMap<string, GeneratorFactory>): void {
  FACTORIES.clear();
  for (const [scheme, factory] of snapshot) FACTORIES.set(scheme, factory);
}

// -- Exports ------------------------------------------------------------------

export {
  clearGeneratorRegistry,
  getGeneratorFactory,
  registerGeneratorFactory,
  restoreGeneratorRegistry,
  snapshotGeneratorRegistry,
};
export type { GeneratorFactory, RomanizationGenerator };
