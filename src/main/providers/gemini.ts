import { readFile } from "node:fs/promises";
import type { GenerationRequest, NormalizedGeneratedImage, ProviderGenerationResult } from "../../shared/types";
import type { FetchLike, ReadFileLike } from "./openai";

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
        inlineData?: {
          mimeType?: string;
          data?: string;
        };
        inline_data?: {
          mime_type?: string;
          data?: string;
        };
      }>;
    };
  }>;
  error?: {
    message?: string;
  };
}

export async function generateGeminiImages(
  request: GenerationRequest,
  fetchImpl: FetchLike = fetch,
  readFileImpl: ReadFileLike = readFile
): Promise<ProviderGenerationResult> {
  const parts = await createGeminiParts(request, readFileImpl);
  const response = await fetchImpl(
    joinUrl(request.provider.baseUrl, `models/${encodeURIComponent(request.provider.model)}:generateContent`),
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": request.provider.apiKey
      },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          responseModalities: ["TEXT", "IMAGE"],
          responseFormat: {
            image: {
              aspectRatio: request.size
            }
          }
        }
      })
    }
  );

  const payload = (await readJson(response)) as GeminiResponse;
  if (!response.ok) {
    throw new Error(payload.error?.message ?? `Gemini request failed with ${response.status}`);
  }

  const images =
    payload.candidates?.flatMap((candidate): NormalizedGeneratedImage[] => {
      return (
        candidate.content?.parts?.flatMap((part): NormalizedGeneratedImage[] => {
          const inline = part.inlineData ?? normalizeSnakeCaseInlineData(part.inline_data);
          if (!inline?.data) {
            return [];
          }

          const mimeType = inline.mimeType ?? "image/png";
          return [
            {
              source: "base64",
              data: inline.data,
              mimeType,
              extension: extensionFromMimeType(mimeType)
            }
          ];
        }) ?? []
      );
    }) ?? [];

  if (images.length === 0) {
    throw new Error("Gemini response did not include any images.");
  }

  return { images };
}

function joinUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error("Provider returned invalid JSON.");
  }
}

function normalizeSnakeCaseInlineData(value?: { mime_type?: string; data?: string }) {
  if (!value) {
    return undefined;
  }

  return {
    mimeType: value.mime_type,
    data: value.data
  };
}

function extensionFromMimeType(mimeType: string): string {
  if (mimeType === "image/jpeg") {
    return "jpg";
  }

  if (mimeType === "image/webp") {
    return "webp";
  }

  return "png";
}

async function createGeminiParts(request: GenerationRequest, readFileImpl: ReadFileLike) {
  const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [{ text: request.prompt }];

  for (const image of request.referenceImages ?? []) {
    const bytes = await readFileImpl(image.filePath);
    parts.push({
      inlineData: {
        mimeType: image.mimeType,
        data: Buffer.from(bytes).toString("base64")
      }
    });
  }

  return parts;
}
