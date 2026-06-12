import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { generateAndPersistImages, validateGenerationConfig } from "./generationWorkflow";
import type { AppConfig, HistoryEntry } from "../shared/types";

const tempDirs: string[] = [];

async function makeTempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "ai-image-workflow-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("generation workflow", () => {
  it("rejects incomplete provider configuration", () => {
    expect(() =>
      validateGenerationConfig({
        ...createConfig(),
        provider: { ...createConfig().provider, apiKey: "" }
      })
    ).toThrow("API Key is required.");
  });

  it("generates, saves images, and appends history", async () => {
    const outputDirectory = await makeTempDir();
    const appendedHistory: HistoryEntry[] = [];
    const fetchImpl = async () =>
      new Response(
        JSON.stringify({
          data: [{ b64_json: Buffer.from("image-data").toString("base64") }]
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      );

    const result = await generateAndPersistImages(
      createConfig({ outputDirectory }),
      { appendHistory: async (entry) => appendedHistory.push(entry) },
      {
        fetchImpl,
        now: () => new Date("2026-06-12T03:04:05.000Z"),
        idFactory: () => "history-id"
      }
    );

    expect(result.historyEntry).toMatchObject({
      id: "history-id",
      createdAt: "2026-06-12T03:04:05.000Z",
      provider: "openai",
      model: "image-model",
      prompt: "glass perfume bottle",
      size: "1024x1024",
      count: 1
    });
    expect(result.images).toHaveLength(1);
    await expect(readFile(result.images[0].filePath, "utf8")).resolves.toBe("image-data");
    expect(appendedHistory).toEqual([result.historyEntry]);
  });
});

function createConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    provider: {
      format: "openai",
      baseUrl: "https://api.example.test/v1",
      apiKey: "key",
      model: "image-model"
    },
    prompt: "glass perfume bottle",
    size: "1024x1024",
    count: 1,
    outputDirectory: "C:/tmp",
    ...overrides
  };
}
