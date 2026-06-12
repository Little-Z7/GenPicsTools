export type ProviderFormat = "openai" | "gemini";

export interface ProviderSettings {
  format: ProviderFormat;
  baseUrl: string;
  apiKey: string;
  model: string;
}

export interface AppConfig {
  provider: ProviderSettings;
  prompt: string;
  size: string;
  count: number;
  outputDirectory: string;
}

export interface GenerationRequest {
  provider: ProviderSettings;
  prompt: string;
  size: string;
  count: number;
}

export type NormalizedGeneratedImage =
  | {
      source: "base64";
      data: string;
      mimeType: string;
      extension: string;
      revisedPrompt?: string;
    }
  | {
      source: "url";
      url: string;
      mimeType: string;
      extension: string;
      revisedPrompt?: string;
    };

export interface ProviderGenerationResult {
  images: NormalizedGeneratedImage[];
}

export interface SavedImage {
  filePath: string;
  fileUrl: string;
  revisedPrompt?: string;
}

export interface GenerationResult {
  images: SavedImage[];
  historyEntry: HistoryEntry;
}

export interface HistoryEntry {
  id: string;
  createdAt: string;
  provider: ProviderFormat;
  model: string;
  prompt: string;
  size: string;
  count: number;
  images: SavedImage[];
}
