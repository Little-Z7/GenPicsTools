export type ProviderFormat = "openai" | "gemini" | "workflow";

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
  concurrency?: number;
}

export interface GenerationRequest {
  provider: ProviderSettings;
  prompt: string;
  size: string;
  count: number;
  referenceImages?: ReferenceImageRecord[];
}

export type ProviderProgressStatus = "queued" | "running";

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

export type TaskStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled";

export interface ReferenceImageRecord {
  id: string;
  filePath: string;
  fileUrl: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
}

export interface TaskOutputRecord extends SavedImage {
  id?: string;
  createdAt?: string;
}

export interface CreateTaskInput {
  provider: ProviderFormat;
  baseUrl: string;
  apiKey: string;
  model: string;
  prompt: string;
  size: string;
  count: number;
  outputDirectory: string;
  referenceImages: ReferenceImageRecord[];
}

export interface GenerationTask extends CreateTaskInput {
  id: string;
  status: TaskStatus;
  error?: string;
  retryCount: number;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
  outputs: TaskOutputRecord[];
}

export interface QueueSettings {
  provider: ProviderSettings;
  size: string;
  count: number;
  outputDirectory: string;
  concurrency: number;
}
