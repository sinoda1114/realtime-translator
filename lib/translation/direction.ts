import type { Direction, SourceLanguage, TargetLanguage } from "@/types/translation";

export function getTargetLanguage(source: SourceLanguage): TargetLanguage {
  return source === "ja" ? "en" : "ja";
}

export function getDirection(source: SourceLanguage): Direction {
  return source === "ja" ? "ja-to-en" : "en-to-ja";
}
