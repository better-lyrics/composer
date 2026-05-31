import type { LyricLine } from "@/domain/line/model";
import type { ProjectMetadata } from "@/domain/project/metadata";
import { formatTime } from "@/utils/format-time";

// -- Constants ----------------------------------------------------------------

const COMPOSER_URL = "https://composer.boidu.dev";

// -- Helpers ------------------------------------------------------------------

function escapeXml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;");
}

function shouldEmitTransliterations(metadata: ProjectMetadata, lines: LyricLine[]): boolean {
  if (!metadata.romanizationScheme) return false;
  return lines.some((line) => line.romanization && line.romanization.text.length > 0);
}

type EmittableLine = { id: string; romanization: NonNullable<LyricLine["romanization"]> };

function selectEmittableLines(lines: LyricLine[]): EmittableLine[] {
  const out: EmittableLine[] = [];
  for (const line of lines) {
    const r = line.romanization;
    if (!r || r.text.length === 0) continue;
    out.push({ id: line.id, romanization: r });
  }
  return out;
}

function emitWordSpans(
  r: NonNullable<LyricLine["romanization"]>,
  ind: (n: number) => string,
  indent: number,
): string[] {
  const parts: string[] = [];
  if (!r.words?.length) return parts;
  for (const w of r.words) {
    parts.push(
      `${ind(indent)}<span begin="${formatTime(w.begin)}" end="${formatTime(w.end)}">${escapeXml(w.text)}</span>`,
    );
  }
  return parts;
}

function emitAppleShape(scheme: string, emittable: EmittableLine[], ind: (n: number) => string): string[] {
  const parts: string[] = [];
  parts.push(`${ind(4)}<transliteration xml:lang="${escapeXml(scheme)}">`);
  for (const { id, romanization: r } of emittable) {
    if (r.words?.length) {
      parts.push(`${ind(5)}<text for="${escapeXml(id)}">`);
      parts.push(...emitWordSpans(r, ind, 6));
      parts.push(`${ind(5)}</text>`);
    } else {
      parts.push(`${ind(5)}<text for="${escapeXml(id)}">${escapeXml(r.text)}</text>`);
    }
  }
  parts.push(`${ind(4)}</transliteration>`);
  return parts;
}

function emitPerLineShape(scheme: string, emittable: EmittableLine[], ind: (n: number) => string): string[] {
  const parts: string[] = [];
  for (const { id, romanization: r } of emittable) {
    parts.push(`${ind(4)}<transliteration for="${escapeXml(id)}" xml:lang="${escapeXml(scheme)}">`);
    if (r.words?.length) {
      parts.push(`${ind(5)}<text>`);
      parts.push(...emitWordSpans(r, ind, 6));
      parts.push(`${ind(5)}</text>`);
    } else {
      parts.push(`${ind(5)}<text>${escapeXml(r.text)}</text>`);
    }
    parts.push(`${ind(4)}</transliteration>`);
  }
  return parts;
}

function emitTransliterationsBlock(
  metadata: ProjectMetadata,
  lines: LyricLine[],
  ind: (n: number) => string,
): string[] {
  const scheme = metadata.romanizationScheme ?? "";
  const emittable = selectEmittableLines(lines);
  const parts: string[] = [];
  parts.push(`${ind(3)}<transliterations>`);
  parts.push(...emitAppleShape(scheme, emittable, ind));
  parts.push(...emitPerLineShape(scheme, emittable, ind));
  parts.push(`${ind(3)}</transliterations>`);
  return parts;
}

function emitGeneratorElement(version: string, ind: (n: number) => string): string {
  return `${ind(3)}<composer:generator version="${escapeXml(version)}" url="${COMPOSER_URL}"/>`;
}

// -- Exports ------------------------------------------------------------------

export { emitGeneratorElement, emitTransliterationsBlock, shouldEmitTransliterations };
