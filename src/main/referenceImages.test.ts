import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { importReferenceImages } from "./referenceImages";

const tempDirs: string[] = [];

async function makeTempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "ai-image-ref-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("reference image import", () => {
  it("copies supported reference images into the app reference directory", async () => {
    const dir = await makeTempDir();
    const sourceDir = join(dir, "source");
    const appDataDir = join(dir, "app");
    await mkdir(sourceDir);
    const sourcePath = join(sourceDir, "产品 图.png");
    await writeFile(sourcePath, "image-bytes");

    const images = await importReferenceImages([sourcePath], appDataDir, {
      idFactory: () => "fixed-id"
    });

    expect(images).toEqual([
      {
        id: "fixed-id",
        filePath: join(appDataDir, "references", "fixed-id.png"),
        fileUrl: expect.stringMatching(/^file:\/\//),
        originalName: "产品 图.png",
        mimeType: "image/png",
        sizeBytes: 11
      }
    ]);
    await expect(readFile(images[0].filePath, "utf8")).resolves.toBe("image-bytes");
  });

  it("accepts jpg, jpeg, and webp extensions", async () => {
    const dir = await makeTempDir();
    const sourcePaths = await Promise.all(
      ["a.jpg", "b.jpeg", "c.webp"].map(async (name) => {
        const filePath = join(dir, name);
        await writeFile(filePath, name);
        return filePath;
      })
    );

    const images = await importReferenceImages(sourcePaths, join(dir, "app"), {
      idFactory: () => `id-${imagesCreated++}`
    });

    expect(images.map((image) => [basename(image.filePath), image.mimeType])).toEqual([
      ["id-0.jpg", "image/jpeg"],
      ["id-1.jpg", "image/jpeg"],
      ["id-2.webp", "image/webp"]
    ]);
  });

  it("rejects unsupported reference file extensions", async () => {
    const dir = await makeTempDir();
    const sourcePath = join(dir, "notes.txt");
    await writeFile(sourcePath, "not an image");

    await expect(importReferenceImages([sourcePath], join(dir, "app"))).rejects.toThrow(
      "Unsupported reference image format"
    );
  });
});

let imagesCreated = 0;
