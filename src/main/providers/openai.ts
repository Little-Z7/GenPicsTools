import type { GenerationRequest, NormalizedGeneratedImage, ProviderGenerationResult } from "../../shared/types";

export type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

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
  fetchImpl: FetchLike = fetch
): Promise<ProviderGenerationResult> {
  const response = await fetchImpl(joinUrl(request.provider.baseUrl, "images/generations"), {
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

function joinUrl(baseUrl: string, path: string): string {
  const normalizedBase = baseUrl.trim().replace(/\/+$/, "");
  const normalizedPath = path.replace(/^\/+/, "");
  if (normalizedBase.toLowerCase().endsWith(`/${normalizedPath.toLowerCase()}`)) {
    return normalizedBase;
  }

  return `${normalizedBase}/${normalizedPath}`;
}

function normalizeAuthorization(apiKey: string): string {
  const trimmed = apiKey.trim();
  return trimmed.toLowerCase().startsWith("bearer ") ? trimmed : `Bearer ${trimmed}`;
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
