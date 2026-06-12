import type { GenerationRequest, ProviderGenerationResult } from "../../shared/types";
import { generateGeminiImages } from "./gemini";
import { generateOpenAIImages, type FetchLike, type ReadFileLike } from "./openai";

export async function generateWithProvider(
  request: GenerationRequest,
  fetchImpl?: FetchLike,
  readFileImpl?: ReadFileLike
): Promise<ProviderGenerationResult> {
  if (request.provider.format === "gemini") {
    return generateGeminiImages(request, fetchImpl, readFileImpl);
  }

  return generateOpenAIImages(request, fetchImpl, readFileImpl);
}

export type { FetchLike, ReadFileLike };
