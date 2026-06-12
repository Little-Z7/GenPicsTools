import { describe, expect, it } from "vitest";
import type { GenerationTask } from "./types";
import { createRegenerateTaskInput } from "./regenerateTask";

describe("createRegenerateTaskInput", () => {
  it("copies generation settings from a task without carrying task state or outputs", () => {
    const task: GenerationTask = {
      id: "task-1",
      status: "succeeded",
      provider: "openai",
      baseUrl: "https://api.example.test/v1",
      apiKey: "sk-test",
      model: "gpt-image-1",
      prompt: "a neon product render",
      size: "1536x1024",
      count: 2,
      outputDirectory: "C:/outputs",
      referenceImages: [
        {
          id: "ref-1",
          filePath: "C:/refs/ref.png",
          fileUrl: "file:///C:/refs/ref.png",
          originalName: "ref.png",
          mimeType: "image/png",
          sizeBytes: 128
        }
      ],
      outputs: [
        {
          id: "out-1",
          filePath: "C:/outputs/out.png",
          fileUrl: "file:///C:/outputs/out.png",
          createdAt: "2026-06-12T01:00:00.000Z"
        }
      ],
      retryCount: 3,
      createdAt: "2026-06-12T00:00:00.000Z",
      updatedAt: "2026-06-12T01:00:00.000Z",
      startedAt: "2026-06-12T00:01:00.000Z",
      completedAt: "2026-06-12T00:02:00.000Z"
    };

    const input = createRegenerateTaskInput(task);

    expect(input).toEqual({
      provider: "openai",
      baseUrl: "https://api.example.test/v1",
      apiKey: "sk-test",
      model: "gpt-image-1",
      prompt: "a neon product render",
      size: "1536x1024",
      count: 2,
      outputDirectory: "C:/outputs",
      referenceImages: task.referenceImages
    });
    expect(input).not.toHaveProperty("id");
    expect(input).not.toHaveProperty("status");
    expect(input).not.toHaveProperty("outputs");
    expect(input.referenceImages).not.toBe(task.referenceImages);
  });
});
