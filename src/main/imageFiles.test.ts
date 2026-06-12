import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { saveGeneratedImages } from "./imageFiles";
import type { NormalizedGeneratedImage } from "../shared/types";

const tempDirs: string[] = [];

async function makeTempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "ai-image-files-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("image file saving", () => {
  it("saves base64 generated images with preview file URLs", async () => {
    const outputDirectory = await makeTempDir();
    const image: NormalizedGeneratedImage = {
      source: "base64",
      data: Buffer.from("image-bytes").toString("base64"),
      mimeType: "image/png",
      extension: "png"
    };

    const saved = await saveGeneratedImages([image], outputDirectory, {
      now: () => new Date("2026-06-12T03:04:05.000Z")
    });

    expect(saved).toHaveLength(1);
    expect(saved[0].filePath).toContain("20260612-030405-1.png");
    expect(saved[0].fileUrl).toMatch(/^file:\/\//);
    await expect(readFile(saved[0].filePath, "utf8")).resolves.toBe("image-bytes");
  });

  it("downloads URL generated images before saving", async () => {
    const outputDirectory = await makeTempDir();
    const fetchImpl = async () => new Response(Buffer.from("remote-image"), { status: 200 });

    const saved = await saveGeneratedImages(
      [
        {
          source: "url",
          url: "https://cdn.example.test/result.webp",
          mimeType: "image/webp",
          extension: "webp"
        }
      ],
      outputDirectory,
      {
        now: () => new Date("2026-06-12T03:04:05.000Z"),
        fetchImpl
      }
    );

    expect(saved[0].filePath).toContain("20260612-030405-1.webp");
    await expect(readFile(saved[0].filePath, "utf8")).resolves.toBe("remote-image");
  });
});
