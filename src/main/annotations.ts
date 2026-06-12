import { mkdir, writeFile } from "node:fs/promises";
import { basename, dirname, extname, join } from "node:path";
import { pathToFileURL } from "node:url";
import type { SavedImage, TaskOutputRecord } from "../shared/types";
import type { TaskStore } from "./taskStore";

interface SaveAnnotationOptions {
  now?: () => Date;
}

type OutputRecorder = Pick<TaskStore, "addOutput">;

export async function saveAnnotatedImage(
  taskId: string,
  sourcePath: string,
  dataUrl: string,
  store: OutputRecorder,
  options: SaveAnnotationOptions = {}
): Promise<SavedImage> {
  const bytes = decodePngDataUrl(dataUrl);
  const createdAt = (options.now?.() ?? new Date()).toISOString();
  const outputPath = buildAnnotatedPath(sourcePath, new Date(createdAt));
  const saved: TaskOutputRecord = {
    filePath: outputPath,
    fileUrl: pathToFileURL(outputPath).toString(),
    revisedPrompt: "Annotated copy"
  };

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, bytes);
  store.addOutput(taskId, saved, createdAt);
  return saved;
}

function decodePngDataUrl(dataUrl: string): Buffer {
  const match = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match) {
    throw new Error("Only PNG annotation data can be saved");
  }

  return Buffer.from(match[1], "base64");
}

function buildAnnotatedPath(sourcePath: string, date: Date): string {
  const extension = extname(sourcePath);
  const baseName = basename(sourcePath, extension);
  return join(dirname(sourcePath), `${baseName}-annotated-${formatTimestamp(date)}.png`);
}

function formatTimestamp(date: Date): string {
  const pad = (value: number) => value.toString().padStart(2, "0");
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
