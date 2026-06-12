import { readFile } from "node:fs/promises";
import type { GenerationRequest, NormalizedGeneratedImage, ProviderGenerationResult } from "../../shared/types";

export type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
export type ReadFileLike = (filePath: string) => Promise<Buffer>;

interface OpenAIImageResponse {
  data?: Array<{
    b64_json?: string;
    url?: string;
    revised_prompt?: string;
  }>;
  error?: {
    message?: string;
  };
}

export async function generateOpenAIImages(
  request: GenerationRequest,
  fetchImpl: FetchLike = fetch,
  readFileImpl: ReadFileLike = readFile
): Promise<ProviderGenerationResult> {
  const referenceImages = request.referenceImages ?? [];
  const response =
    referenceImages.length > 0
      ? await generateOpenAIEdit(request, referenceImages, fetchImpl, readFileImpl)
      : await generateOpenAITextImage(request, fetchImpl);

  const payload = (await readJson(response)) as OpenAIImageResponse;
  if (!response.ok) {
    throw new Error(payload.error?.message ?? `OpenAI-compatible request failed with ${response.status}`);
  }

  const images =
    payload.data?.flatMap((item): NormalizedGeneratedImage[] => {
      if (item.b64_json) {
        return [
          {
            source: "base64",
            data: item.b64_json,
            mimeType: "image/png",
            extension: "png",
            revisedPrompt: item.revised_prompt
          }
        ];
      }

      if (item.url) {
        const extension = extensionFromUrl(item.url);
        return [
          {
            source: "url",
            url: item.url,
            mimeType: mimeTypeFromExtension(extension),
            extension,
            revisedPrompt: item.revised_prompt
          }
        ];
      }

      return [];
    }) ?? [];

  if (images.length === 0) {
    throw new Error("OpenAI-compatible response did not include any images.");
  }

  return { images };
}

async function generateOpenAITextImage(request: GenerationRequest, fetchImpl: FetchLike): Promise<Response> {
  return fetchImpl(resolveOpenAIEndpoint(request.provider.baseUrl, "images/generations"), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: normalizeAuthorization(request.provider.apiKey)
    },
    body: JSON.stringify({
      model: request.provider.model,
      prompt: request.prompt,
      n: request.count,
      size: request.size,
      response_format: "b64_json"
    })
  });
}

async function generateOpenAIEdit(
  request: GenerationRequest,
  referenceImages: NonNullable<GenerationRequest["referenceImages"]>,
  fetchImpl: FetchLike,
  readFileImpl: ReadFileLike
): Promise<Response> {
  const formData = new FormData();
  formData.set("model", request.provider.model);
  formData.set("prompt", request.prompt);
  formData.set("n", String(request.count));
  formData.set("size", request.size);
  formData.set("response_format", "b64_json");

  for (const image of referenceImages) {
    const bytes = await readFileImpl(image.filePath);
    const arrayBuffer = new Uint8Array(bytes).buffer;
    formData.append("image", new Blob([arrayBuffer], { type: image.mimeType }), image.originalName);
  }

  return fetchImpl(resolveOpenAIEndpoint(request.provider.baseUrl, "images/edits"), {
    method: "POST",
    headers: {
      authorization: normalizeAuthorization(request.provider.apiKey)
    },
    body: formData
  });
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

function extensionFromUrl(value: string): string {
  try {
    const pathname = new URL(value).pathname.toLowerCase();
    const match = pathname.match(/\.([a-z0-9]+)$/);
    return normalizeExtension(match?.[1]);
  } catch {
    return "png";
  }
}

function normalizeExtension(value?: string): string {
  if (value === "jpg" || value === "jpeg") {
    return "jpg";
  }

  if (value === "webp") {
    return "webp";
  }

  return "png";
}

function mimeTypeFromExtension(extension: string): string {
  if (extension === "jpg") {
    return "image/jpeg";
  }

  if (extension === "webp") {
    return "image/webp";
  }

  return "image/png";
}

function resolveOpenAIEndpoint(baseUrl: string, endpoint: "images/generations" | "images/edits"): string {
  const normalizedBase = baseUrl.trim().replace(/\/+$/, "");
  const lowerBase = normalizedBase.toLowerCase();
  if (lowerBase.endsWith("/images/generations")) {
    return normalizedBase.replace(/\/images\/generations$/i, `/${endpoint}`);
  }

  if (lowerBase.endsWith("/images/edits")) {
    return normalizedBase.replace(/\/images\/edits$/i, `/${endpoint}`);
  }

  return `${normalizedBase}/${endpoint}`;
}

function normalizeAuthorization(apiKey: string): string {
  const trimmed = apiKey.trim();
  return trimmed.toLowerCase().startsWith("bearer ") ? trimmed : `Bearer ${trimmed}`;
}
