import type { GenerationRequest, ProviderGenerationResult } from "../../shared/types";
import { generateGeminiImages } from "./gemini";
import { generateOpenAIImages, type FetchLike } from "./openai";

export async function generateWithProvider(
  request: GenerationRequest,
  fetchImpl?: FetchLike
): Promise<ProviderGenerationResult> {
  if (request.provider.format === "gemini") {
    return generateGeminiImages(request, fetchImpl);
  }

  return generateOpenAIImages(request, fetchImpl);
}

export type { FetchLike };
