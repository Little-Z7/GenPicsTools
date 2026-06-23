import type { GenerationRequest, ProviderGenerationResult, ProviderProgressStatus } from "../../shared/types";
import { generateGeminiImages } from "./gemini";
import { generateOpenAIImages, type FetchLike, type ReadFileLike } from "./openai";
import { generateSeeThroughWorkflow } from "./runninghub";

export async function generateWithProvider(
  request: GenerationRequest,
  fetchImpl?: FetchLike,
  readFileImpl?: ReadFileLike,
  onStatus?: (status: ProviderProgressStatus) => void
): Promise<ProviderGenerationResult> {
  if (request.provider.format === "gemini") {
    return generateGeminiImages(request, fetchImpl, readFileImpl);
  }

  if (request.provider.format === "workflow") {
    return generateSeeThroughWorkflow(request, fetchImpl, readFileImpl, onStatus);
  }

  return generateOpenAIImages(request, fetchImpl, readFileImpl);
}

export type { FetchLike, ReadFileLike };
