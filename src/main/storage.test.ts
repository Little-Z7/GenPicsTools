import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { createStorage } from "./storage";
import type { AppConfig, HistoryEntry } from "../shared/types";

const tempDirs: string[] = [];

async function makeTempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "ai-image-tool-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("storage", () => {
  it("creates a default config when no config file exists", async () => {
    const userDataPath = await makeTempDir();
    const storage = createStorage(userDataPath);

    const config = await storage.loadConfig();

    expect(config).toMatchObject({
      provider: {
        format: "openai",
        baseUrl: "https://api.openai.com/v1",
        apiKey: "",
        model: "gpt-image-1"
      },
      prompt: "",
      size: "1024x1024",
      count: 1,
      outputDirectory: join(userDataPath, "outputs")
    });
  });

  it("saves and loads config", async () => {
    const userDataPath = await makeTempDir();
    const storage = createStorage(userDataPath);
    const config: AppConfig = {
      provider: {
        format: "gemini",
        baseUrl: "https://generativelanguage.googleapis.com/v1beta",
        apiKey: "secret",
        model: "gemini-2.5-flash-image"
      },
      prompt: "chrome headphones on a desk",
      size: "16:9",
      count: 2,
      outputDirectory: join(userDataPath, "custom")
    };

    await storage.saveConfig(config);

    await expect(storage.loadConfig()).resolves.toEqual(config);
  });

  it("appends history entries newest first", async () => {
    const userDataPath = await makeTempDir();
    const storage = createStorage(userDataPath);
    const first = createHistoryEntry("first", "2026-06-12T01:00:00.000Z");
    const second = createHistoryEntry("second", "2026-06-12T02:00:00.000Z");

    await storage.appendHistory(first);
    await storage.appendHistory(second);

    const history = await storage.loadHistory();
    expect(history.map((entry) => entry.id)).toEqual(["second", "first"]);
  });
});

function createHistoryEntry(id: string, createdAt: string): HistoryEntry {
  return {
    id,
    createdAt,
    provider: "openai",
    model: "image-model",
    prompt: `prompt ${id}`,
    size: "1024x1024",
    count: 1,
    images: [
      {
        filePath: `C:/tmp/${id}.png`,
        fileUrl: `file:///C:/tmp/${id}.png`
      }
    ]
  };
}
