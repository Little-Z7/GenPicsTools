import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { AppConfig, HistoryEntry } from "../shared/types";

export interface AppStorage {
  loadConfig: () => Promise<AppConfig>;
  saveConfig: (config: AppConfig) => Promise<void>;
  loadHistory: () => Promise<HistoryEntry[]>;
  appendHistory: (entry: HistoryEntry) => Promise<void>;
}

export function createStorage(userDataPath: string): AppStorage {
  const configPath = join(userDataPath, "config.json");
  const historyPath = join(userDataPath, "history.json");

  return {
    async loadConfig() {
      const config = await readJsonFile<AppConfig>(configPath);
      return config ?? createDefaultConfig(userDataPath);
    },

    async saveConfig(config) {
      await writeJsonFile(configPath, config);
    },

    async loadHistory() {
      const history = (await readJsonFile<HistoryEntry[]>(historyPath)) ?? [];
      return sortHistory(history);
    },

    async appendHistory(entry) {
      const history = await this.loadHistory();
      await writeJsonFile(historyPath, sortHistory([entry, ...history]));
    }
  };
}

export function createDefaultConfig(userDataPath: string): AppConfig {
  return {
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
  };
}

async function readJsonFile<T>(filePath: string): Promise<T | undefined> {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as T;
  } catch (error) {
    if (isMissingFileError(error)) {
      return undefined;
    }

    throw error;
  }
}

async function writeJsonFile(filePath: string, value: unknown): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function isMissingFileError(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "ENOENT");
}

function sortHistory(history: HistoryEntry[]): HistoryEntry[] {
  return history.slice().sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}
