import crypto from "node:crypto";
import { copyFile, mkdir, stat } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import { pathToFileURL } from "node:url";
import type { ReferenceImageRecord } from "../shared/types";

interface ImportReferenceImagesOptions {
  idFactory?: () => string;
}

const supportedTypes = new Map([
  [".png", { mimeType: "image/png", extension: "png" }],
  [".jpg", { mimeType: "image/jpeg", extension: "jpg" }],
  [".jpeg", { mimeType: "image/jpeg", extension: "jpg" }],
  [".webp", { mimeType: "image/webp", extension: "webp" }]
]);

export async function importReferenceImages(
  sourcePaths: string[],
  appDataPath: string,
  options: ImportReferenceImagesOptions = {}
): Promise<ReferenceImageRecord[]> {
  const referenceDir = join(appDataPath, "references");
  await mkdir(referenceDir, { recursive: true });
  const idFactory = options.idFactory ?? (() => crypto.randomUUID());

  return Promise.all(
    sourcePaths.map(async (sourcePath) => {
      const type = supportedTypes.get(extname(sourcePath).toLowerCase());
      if (!type) {
        throw new Error(`Unsupported reference image format: ${sourcePath}`);
      }

      const id = idFactory();
      const filePath = join(referenceDir, `${id}.${type.extension}`);
      await copyFile(sourcePath, filePath);
      const fileStat = await stat(filePath);

      return {
        id,
        filePath,
        fileUrl: pathToFileURL(filePath).toString(),
        originalName: basename(sourcePath),
        mimeType: type.mimeType,
        sizeBytes: fileStat.size
      };
    })
  );
}
