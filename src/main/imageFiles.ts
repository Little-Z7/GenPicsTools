import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type { NormalizedGeneratedImage, SavedImage } from "../shared/types";
import type { FetchLike } from "./providers";

export interface SaveGeneratedImagesOptions {
  now?: () => Date;
  fetchImpl?: FetchLike;
}

export async function saveGeneratedImages(
  images: NormalizedGeneratedImage[],
  outputDirectory: string,
  options: SaveGeneratedImagesOptions = {}
): Promise<SavedImage[]> {
  await mkdir(outputDirectory, { recursive: true });
  const now = options.now ?? (() => new Date());
  const timestamp = formatTimestamp(now());

  return Promise.all(
    images.map(async (image, index) => {
      const filePath = join(outputDirectory, `${timestamp}-${index + 1}.${image.extension}`);
      const bytes = await readImageBytes(image, options.fetchImpl ?? fetch);
      await writeFile(filePath, bytes);

      return {
        filePath,
        fileUrl: pathToFileURL(filePath).toString(),
        revisedPrompt: image.revisedPrompt
      };
    })
  );
}

async function readImageBytes(image: NormalizedGeneratedImage, fetchImpl: FetchLike): Promise<Buffer> {
  if (image.source === "base64") {
    return Buffer.from(image.data, "base64");
  }

  const response = await fetchImpl(image.url);
  if (!response.ok) {
    throw new Error(`Image download failed with ${response.status}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

function formatTimestamp(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return [
    date.getUTCFullYear(),
    pad(date.getUTCMonth() + 1),
    pad(date.getUTCDate()),
    "-",
    pad(date.getUTCHours()),
    pad(date.getUTCMinutes()),
    pad(date.getUTCSeconds())
  ].join("");
}
