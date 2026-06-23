import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { openAppDatabase, type AppDatabase } from "./db";
import { createTaskRunner } from "./taskRunner";
import { createTaskStore } from "./taskStore";
import type { CreateTaskInput, NormalizedGeneratedImage, SavedImage } from "../shared/types";

const tempDirs: string[] = [];
const openDbs: AppDatabase[] = [];

async function makeTempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "ai-image-runner-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  for (const db of openDbs.splice(0)) {
    db.close();
  }
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("task runner", () => {
  it("runs queued tasks with a concurrency limit and saves outputs", async () => {
    const dir = await makeTempDir();
    const db = openAppDatabase(join(dir, "app.sqlite"));
    openDbs.push(db);
    const store = createTaskStore(db);
    store.createTask(createTaskInput("one"));
    store.createTask(createTaskInput("two"));
    store.createTask(createTaskInput("three"));
    let active = 0;
    let maxActive = 0;

    const runner = createTaskRunner(store, {
      concurrency: 2,
      generate: async () => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        await delay(20);
        active -= 1;
        return { images: [createNormalizedImage()] };
      },
      saveImages: async (_images, _outputDirectory, task) => [createSavedImage(task.id)]
    });

    await runner.runUntilIdle();

    expect(maxActive).toBe(2);
    expect(store.listTasks().map((task) => task.status)).toEqual(["succeeded", "succeeded", "succeeded"]);
    expect(store.listTasks().every((task) => task.outputs.length === 1)).toBe(true);
  });

  it("marks failed tasks with the provider error", async () => {
    const dir = await makeTempDir();
    const db = openAppDatabase(join(dir, "app.sqlite"));
    openDbs.push(db);
    const store = createTaskStore(db);
    const task = store.createTask(createTaskInput("bad"));
    const runner = createTaskRunner(store, {
      concurrency: 1,
      generate: async () => {
        throw new Error("provider rejected request");
      },
      saveImages: async () => []
    });

    await runner.runUntilIdle();

    expect(store.getTask(task.id)).toMatchObject({
      status: "failed",
      error: "provider rejected request"
    });
  });

  it("reports provider queued progress as local queued status while task remains active", async () => {
    const dir = await makeTempDir();
    const db = openAppDatabase(join(dir, "app.sqlite"));
    openDbs.push(db);
    const store = createTaskStore(db);
    const task = store.createTask(createTaskInput("remote-queued"));
    const statuses: string[] = [];
    const runner = createTaskRunner(store, {
      concurrency: 1,
      generate: async (_task, _signal, reportStatus) => {
        reportStatus?.("queued");
        statuses.push(store.getTask(task.id)?.status ?? "missing");
        return { images: [createNormalizedImage()] };
      },
      saveImages: async (_images, _outputDirectory, currentTask) => [createSavedImage(currentTask.id)],
      onTaskChange: (changedTask) => {
        if (changedTask.id === task.id) {
          statuses.push(changedTask.status);
        }
      }
    });

    await runner.runUntilIdle();

    expect(statuses).toContain("queued");
    expect(store.getTask(task.id)?.status).toBe("succeeded");
  });

  it("cancels queued tasks before execution and retry resets them", async () => {
    const dir = await makeTempDir();
    const db = openAppDatabase(join(dir, "app.sqlite"));
    openDbs.push(db);
    const store = createTaskStore(db);
    const task = store.createTask(createTaskInput("cancel"));
    let generateCalls = 0;
    const runner = createTaskRunner(store, {
      concurrency: 1,
      generate: async () => {
        generateCalls += 1;
        return { images: [createNormalizedImage()] };
      },
      saveImages: async (_images, _outputDirectory, currentTask) => [createSavedImage(currentTask.id)]
    });

    runner.cancelTask(task.id);
    await runner.runUntilIdle();
    expect(generateCalls).toBe(0);
    expect(store.getTask(task.id)?.status).toBe("cancelled");

    runner.retryTask(task.id);
    await runner.runUntilIdle();
    expect(generateCalls).toBe(1);
    expect(store.getTask(task.id)).toMatchObject({ status: "succeeded", retryCount: 1 });
  });
});

function createTaskInput(id: string): CreateTaskInput {
  return {
    provider: "openai",
    baseUrl: "https://api.example.test/v1",
    apiKey: "key",
    model: "image-model",
    prompt: `prompt ${id}`,
    size: "1024x1024",
    count: 1,
    outputDirectory: "C:/tmp/outputs",
    referenceImages: []
  };
}

function createNormalizedImage(): NormalizedGeneratedImage {
  return {
    source: "base64",
    data: Buffer.from("image").toString("base64"),
    mimeType: "image/png",
    extension: "png"
  };
}

function createSavedImage(taskId: string): SavedImage {
  return {
    filePath: `C:/tmp/${taskId}.png`,
    fileUrl: `file:///C:/tmp/${taskId}.png`
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
