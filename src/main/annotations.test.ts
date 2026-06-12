import { readFile, rm, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import type { TaskOutputRecord } from "../shared/types";
import { saveAnnotatedImage } from "./annotations";

const tempDirs: string[] = [];

async function makeTempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "ai-image-annotation-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("saveAnnotatedImage", () => {
  it("writes a PNG annotation next to the source image and records it as a task output", async () => {
    const dir = await makeTempDir();
    const bytes = Buffer.from("annotated png bytes");
    const calls: Array<{ taskId: string; output: TaskOutputRecord; now: string | undefined }> = [];
    const expectedPath = join(dir, "source-annotated-20260612-030405.png");

    const saved = await saveAnnotatedImage(
      "task-1",
      join(dir, "source.png"),
      `data:image/png;base64,${bytes.toString("base64")}`,
      {
        addOutput(taskId, output, now) {
          calls.push({ taskId, output, now });
        }
      },
      { now: () => new Date("2026-06-12T03:04:05.000Z") }
    );

    expect(await readFile(expectedPath)).toEqual(bytes);
    expect(saved).toEqual({
      filePath: expectedPath,
      fileUrl: pathToFileURL(expectedPath).toString(),
      revisedPrompt: "Annotated copy"
    });
    expect(calls).toEqual([{ taskId: "task-1", output: saved, now: "2026-06-12T03:04:05.000Z" }]);
  });

  it("rejects non-PNG annotation data", async () => {
    const dir = await makeTempDir();

    await expect(
      saveAnnotatedImage(
        "task-1",
        join(dir, "source.png"),
        "data:text/plain;base64,Zm9v",
        {
          addOutput() {
            throw new Error("should not record invalid data");
          }
        },
        { now: () => new Date("2026-06-12T03:04:05.000Z") }
      )
    ).rejects.toThrow("Only PNG annotation data can be saved");
  });
});
