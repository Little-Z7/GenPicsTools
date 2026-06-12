import type { CreateTaskInput, GenerationTask } from "./types";

export function createRegenerateTaskInput(task: GenerationTask): CreateTaskInput {
  return {
    provider: task.provider,
    baseUrl: task.baseUrl,
    apiKey: task.apiKey,
    model: task.model,
    prompt: task.prompt,
    size: task.size,
    count: task.count,
    outputDirectory: task.outputDirectory,
    referenceImages: task.referenceImages.map((image) => ({ ...image }))
  };
}
