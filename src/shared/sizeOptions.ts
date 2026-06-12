import type { ProviderFormat } from "./types";

export const openAiSizeOptions = [
  "512x512",
  "768x768",
  "1024x1024",
  "1024x1536",
  "1536x1024",
  "1280x720",
  "1920x1080",
  "1080x1920",
  "2048x2048"
] as const;

export const geminiSizeOptions = ["1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3", "4:5", "5:4", "21:9"] as const;

export function getSizeOptions(provider: ProviderFormat): readonly string[] {
  return provider === "gemini" ? geminiSizeOptions : openAiSizeOptions;
}

export function isPresetSize(provider: ProviderFormat, size: string): boolean {
  return getSizeOptions(provider).includes(size);
}
