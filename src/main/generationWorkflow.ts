import type { AppConfig, GenerationResult, HistoryEntry } from "../shared/types";
import { saveGeneratedImages } from "./imageFiles";
import { generateWithProvider, type FetchLike } from "./providers";
import type { AppStorage } from "./storage";

export interface GenerateWorkflowOptions {
  fetchImpl?: FetchLike;
  now?: () => Date;
  idFactory?: () => string;
}

export function validateGenerationConfig(config: AppConfig): void {
  if (!config.provider.baseUrl.trim()) {
    throw new Error("Base URL is required.");
  }

  if (!config.provider.apiKey.trim()) {
    throw new Error("API Key is required.");
  }

  if (!config.provider.model.trim()) {
    throw new Error("Model is required.");
  }

  if (!config.prompt.trim()) {
    throw new Error("Prompt is required.");
  }

  if (!config.outputDirectory.trim()) {
    throw new Error("Output directory is required.");
  }

  if (!Number.isInteger(config.count) || config.count < 1 || config.count > 4) {
    throw new Error("Image count must be between 1 and 4.");
  }
}

export async function generateAndPersistImages(
  config: AppConfig,
  storage: Pick<AppStorage, "appendHistory">,
  options: GenerateWorkflowOptions = {}
): Promise<GenerationResult> {
  validateGenerationConfig(config);

  const now = options.now ?? (() => new Date());
  const createdAtDate = now();
  const providerResult = await generateWithProvider(
    {
      provider: config.provider,
      prompt: config.prompt,
      size: config.size,
      count: config.count
    },
    options.fetchImpl
  );
  const images = await saveGeneratedImages(providerResult.images, config.outputDirectory, {
    fetchImpl: options.fetchImpl,
    now: () => createdAtDate
  });

  const historyEntry: HistoryEntry = {
    id: options.idFactory?.() ?? crypto.randomUUID(),
    createdAt: createdAtDate.toISOString(),
    provider: config.provider.format,
    model: config.provider.model,
    prompt: config.prompt,
    size: config.size,
    count: config.count,
    images
  };

  await storage.appendHistory(historyEntry);

  return {
    images,
    historyEntry
  };
}
