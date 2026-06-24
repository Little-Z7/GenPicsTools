import { readFile } from "node:fs/promises";
import type {
  GenerationRequest,
  NormalizedGeneratedImage,
  ProviderGenerationResult,
  ProviderProgressStatus,
  ReferenceImageRecord
} from "../../shared/types";
import { getWorkflowApp } from "../../shared/workflowApps";
import type { FetchLike, ReadFileLike } from "./openai";

const runningHubBaseUrl = "https://www.runninghub.cn/openapi/v2";

interface RunningHubUploadResponse {
  code?: number;
  message?: string;
  data?: {
    download_url?: string;
    fileName?: string;
  };
}

interface RunningHubTaskResponse {
  taskId?: string;
  status?: string;
  errorCode?: string;
  errorMessage?: string;
  results?: RunningHubResult[] | null;
}

interface RunningHubResult {
  url?: string | null;
  nodeId?: string;
  outputType?: string;
  text?: string | null;
}

export async function generateSeeThroughWorkflow(
  request: GenerationRequest,
  fetchImpl: FetchLike = fetch,
  readFileImpl: ReadFileLike = readFile,
  onStatus?: (status: ProviderProgressStatus) => void
): Promise<ProviderGenerationResult> {
  const workflowApp = getWorkflowApp(request.provider.model);
  if (!workflowApp) {
    throw new Error(`Unsupported workflow app: ${request.provider.model}`);
  }

  const referenceImage = request.referenceImages?.[0];
  if (!referenceImage) {
    throw new Error(`${workflowApp.label} requires one uploaded image.`);
  }

  const fieldValue = await uploadImage(referenceImage, request.provider.apiKey, fetchImpl, readFileImpl);
  const submitted = await submitSeeThroughTask(fieldValue, request.provider.apiKey, workflowApp.appId, workflowApp.inputDescription, fetchImpl);
  emitProviderStatus(submitted.status, onStatus);
  const taskId = submitted.taskId;
  if (!taskId) {
    throw new Error("RunningHub did not return a task ID.");
  }

  const completed = await queryUntilComplete(taskId, request.provider.apiKey, fetchImpl, onStatus);
  return normalizeRunningHubResults(completed);
}

async function uploadImage(
  image: ReferenceImageRecord,
  apiKey: string,
  fetchImpl: FetchLike,
  readFileImpl: ReadFileLike
): Promise<string> {
  const bytes = await readFileImpl(image.filePath);
  const formData = new FormData();
  formData.append("file", new Blob([new Uint8Array(bytes).buffer], { type: image.mimeType }), image.originalName);

  const response = await fetchImpl(`${runningHubBaseUrl}/media/upload/binary`, {
    method: "POST",
    headers: {
      authorization: normalizeAuthorization(apiKey)
    },
    body: formData
  });
  const payload = (await readJson(response)) as RunningHubUploadResponse;
  if (!response.ok || payload.code !== 0) {
    throw new Error(payload.message || `RunningHub upload failed with ${response.status}`);
  }

  const fieldValue = payload.data?.fileName || payload.data?.download_url;
  if (!fieldValue) {
    throw new Error("RunningHub upload did not return a file name.");
  }

  return fieldValue;
}

async function submitSeeThroughTask(
  fieldValue: string,
  apiKey: string,
  appId: string,
  inputDescription: string,
  fetchImpl: FetchLike
): Promise<RunningHubTaskResponse> {
  const response = await fetchImpl(`${runningHubBaseUrl}/run/ai-app/${appId}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: normalizeAuthorization(apiKey)
    },
    body: JSON.stringify({
      nodeInfoList: [
        {
          nodeId: "1",
          fieldName: "image",
          fieldValue,
          description: inputDescription
        }
      ],
      instanceType: "default",
      usePersonalQueue: "false"
    })
  });
  const payload = (await readJson(response)) as RunningHubTaskResponse;
  if (!response.ok || payload.status === "FAILED") {
    throw new Error(payload.errorMessage || `RunningHub submit failed with ${response.status}`);
  }

  return payload;
}

async function queryUntilComplete(
  taskId: string,
  apiKey: string,
  fetchImpl: FetchLike,
  onStatus?: (status: ProviderProgressStatus) => void
): Promise<RunningHubTaskResponse> {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const response = await fetchImpl(`${runningHubBaseUrl}/query`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: normalizeAuthorization(apiKey)
      },
      body: JSON.stringify({ taskId })
    });
    const payload = (await readJson(response)) as RunningHubTaskResponse;
    if (!response.ok) {
      throw new Error(payload.errorMessage || `RunningHub query failed with ${response.status}`);
    }

    emitProviderStatus(payload.status, onStatus);

    if (payload.status === "SUCCESS") {
      return payload;
    }

    if (payload.status === "FAILED") {
      throw new Error(payload.errorMessage || payload.errorCode || "RunningHub workflow failed.");
    }

    await delay(3000);
  }

  throw new Error("RunningHub workflow timed out.");
}

function normalizeRunningHubResults(response: RunningHubTaskResponse): ProviderGenerationResult {
  const images =
    response.results?.flatMap((item): NormalizedGeneratedImage[] => {
      if (!item.url) {
        return [];
      }

      const extension = normalizeExtension(item.outputType || extensionFromUrl(item.url));
      return [
        {
          source: "url",
          url: item.url,
          mimeType: mimeTypeFromExtension(extension),
          extension,
        }
      ];
    }) ?? [];

  if (images.length === 0) {
    throw new Error("RunningHub response did not include any downloadable outputs.");
  }

  return { images };
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error("RunningHub returned invalid JSON.");
  }
}

function extensionFromUrl(value: string): string {
  try {
    const pathname = new URL(value).pathname.toLowerCase();
    return pathname.match(/\.([a-z0-9]+)$/)?.[1] ?? "png";
  } catch {
    return "png";
  }
}

function normalizeExtension(value?: string): string {
  const normalized = value?.toLowerCase().replace(/^\./, "");
  if (normalized === "jpeg") {
    return "jpg";
  }

  return normalized || "png";
}

function mimeTypeFromExtension(extension: string): string {
  if (extension === "jpg") {
    return "image/jpeg";
  }

  if (extension === "webp") {
    return "image/webp";
  }

  if (extension === "mp4") {
    return "video/mp4";
  }

  if (extension === "zip") {
    return "application/zip";
  }

  return "image/png";
}

function normalizeAuthorization(apiKey: string): string {
  const trimmed = apiKey.trim();
  return trimmed.toLowerCase().startsWith("bearer ") ? trimmed : `Bearer ${trimmed}`;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function emitProviderStatus(status: string | undefined, onStatus?: (status: ProviderProgressStatus) => void) {
  if (status === "QUEUED") {
    onStatus?.("queued");
    return;
  }

  if (status === "RUNNING") {
    onStatus?.("running");
  }
}
