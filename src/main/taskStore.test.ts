import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { openAppDatabase, type AppDatabase } from "./db";
import { createTaskStore } from "./taskStore";
import type { CreateTaskInput, ReferenceImageRecord } from "../shared/types";

const tempDirs: string[] = [];
const openDbs: AppDatabase[] = [];

async function makeTempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "ai-image-db-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  for (const db of openDbs.splice(0)) {
    db.close();
  }
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("task store", () => {
  it("persists settings as key/value records", async () => {
    const dir = await makeTempDir();
    const db = openAppDatabase(join(dir, "app.sqlite"));
    openDbs.push(db);
    const store = createTaskStore(db);

    store.setSetting("concurrency", 3);
    store.setSetting("provider", { format: "gemini", model: "gemini-2.5-flash-image" });

    expect(store.getSetting("concurrency")).toBe(3);
    expect(store.getSetting("provider")).toEqual({ format: "gemini", model: "gemini-2.5-flash-image" });
  });

  it("creates queued tasks with reference images and lists newest first", async () => {
    const dir = await makeTempDir();
    const db = openAppDatabase(join(dir, "app.sqlite"));
    openDbs.push(db);
    const store = createTaskStore(db);
    const first = createTaskInput("first", [createReference("ref-a")]);
    const second = createTaskInput("second", [createReference("ref-b")]);

    const firstTask = store.createTask(first, "2026-06-12T01:00:00.000Z");
    const secondTask = store.createTask(second, "2026-06-12T02:00:00.000Z");

    const tasks = store.listTasks();
    expect(tasks.map((task) => task.id)).toEqual([secondTask.id, firstTask.id]);
    expect(tasks[0]).toMatchObject({
      id: secondTask.id,
      status: "queued",
      prompt: "prompt second",
      provider: "openai",
      model: "image-model",
      size: "1024x1024",
      count: 1,
      referenceImages: [{ originalName: "ref-b.png", mimeType: "image/png" }],
      outputs: []
    });
  });

  it("allows multiple tasks to reuse the same reference image metadata", async () => {
    const dir = await makeTempDir();
    const db = openAppDatabase(join(dir, "app.sqlite"));
    openDbs.push(db);
    const store = createTaskStore(db);
    const reference = createReference("shared-ref");

    const firstTask = store.createTask(createTaskInput("first", [reference]), "2026-06-12T01:00:00.000Z");
    const secondTask = store.createTask(createTaskInput("second", [reference]), "2026-06-12T02:00:00.000Z");

    expect(store.getTask(firstTask.id)?.referenceImages).toMatchObject([{ filePath: reference.filePath }]);
    expect(store.getTask(secondTask.id)?.referenceImages).toMatchObject([{ filePath: reference.filePath }]);
    expect(store.getTask(firstTask.id)?.referenceImages[0]?.id).not.toBe(
      store.getTask(secondTask.id)?.referenceImages[0]?.id
    );
  });

  it("updates task status, outputs, errors, retry state, and cancellation", async () => {
    const dir = await makeTempDir();
    const db = openAppDatabase(join(dir, "app.sqlite"));
    openDbs.push(db);
    const store = createTaskStore(db);
    const task = store.createTask(createTaskInput("task"), "2026-06-12T01:00:00.000Z");

    store.markRunning(task.id, "2026-06-12T01:01:00.000Z");
    expect(store.getTask(task.id)?.status).toBe("running");

    store.addOutput(task.id, {
      filePath: join(dir, "out.png"),
      fileUrl: "file:///out.png",
      revisedPrompt: "revised"
    });
    store.markSucceeded(task.id, "2026-06-12T01:02:00.000Z");
    expect(store.getTask(task.id)).toMatchObject({
      status: "succeeded",
      outputs: [{ fileUrl: "file:///out.png", revisedPrompt: "revised" }]
    });

    store.markFailed(task.id, "bad request", "2026-06-12T01:03:00.000Z");
    expect(store.getTask(task.id)).toMatchObject({ status: "failed", error: "bad request" });

    store.retryTask(task.id, "2026-06-12T01:04:00.000Z");
    expect(store.getTask(task.id)).toMatchObject({ status: "queued", error: undefined, retryCount: 1 });

    store.cancelTask(task.id, "2026-06-12T01:05:00.000Z");
    expect(store.getTask(task.id)?.status).toBe("cancelled");
  });
});

function createTaskInput(id: string, referenceImages: ReferenceImageRecord[] = []): CreateTaskInput {
  return {
    provider: "openai",
    baseUrl: "https://api.example.test/v1",
    apiKey: "key",
    model: "image-model",
    prompt: `prompt ${id}`,
    size: "1024x1024",
    count: 1,
    outputDirectory: "C:/tmp/outputs",
    referenceImages
  };
}

function createReference(id: string): ReferenceImageRecord {
  return {
    id,
    filePath: `C:/tmp/${id}.png`,
    fileUrl: `file:///C:/tmp/${id}.png`,
    originalName: `${id}.png`,
    mimeType: "image/png",
    sizeBytes: 128
  };
}
