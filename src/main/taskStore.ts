import crypto from "node:crypto";
import type {
  CreateTaskInput,
  GenerationTask,
  ReferenceImageRecord,
  TaskOutputRecord,
  TaskStatus
} from "../shared/types";
import type { AppDatabase } from "./db";

interface TaskRow {
  id: string;
  status: TaskStatus;
  provider: "openai" | "gemini" | "workflow";
  base_url: string;
  api_key: string;
  model: string;
  prompt: string;
  size: string;
  count: number;
  output_directory: string;
  error: string | null;
  retry_count: number;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  completed_at: string | null;
}

interface ReferenceRow {
  id: string;
  file_path: string;
  file_url: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
}

interface OutputRow {
  id: string;
  file_path: string;
  file_url: string;
  revised_prompt: string | null;
  created_at: string;
}

export interface TaskStore {
  getSetting: <T = unknown>(key: string) => T | undefined;
  setSetting: (key: string, value: unknown) => void;
  createTask: (input: CreateTaskInput, now?: string) => GenerationTask;
  listTasks: () => GenerationTask[];
  getTask: (taskId: string) => GenerationTask | undefined;
  listQueuedTasks: (limit: number) => GenerationTask[];
  markQueued: (taskId: string, now?: string) => void;
  markRunning: (taskId: string, now?: string) => void;
  markSucceeded: (taskId: string, now?: string) => void;
  markFailed: (taskId: string, error: string, now?: string) => void;
  retryTask: (taskId: string, now?: string) => void;
  cancelTask: (taskId: string, now?: string) => void;
  addOutput: (taskId: string, output: TaskOutputRecord, now?: string) => void;
}

export function createTaskStore(db: AppDatabase): TaskStore {
  return {
    getSetting<T = unknown>(key: string): T | undefined {
      const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as { value: string } | undefined;
      return row ? (JSON.parse(row.value) as T) : undefined;
    },

    setSetting(key: string, value: unknown): void {
      db.prepare(
        "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
      ).run(key, JSON.stringify(value));
    },

    createTask(input: CreateTaskInput, now = new Date().toISOString()): GenerationTask {
      const taskId = crypto.randomUUID();
      const insertTask = db.prepare(`
        INSERT INTO tasks (
          id, status, provider, base_url, api_key, model, prompt, size, count,
          output_directory, retry_count, created_at, updated_at
        )
        VALUES (?, 'queued', ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
      `);
      const insertReference = db.prepare(`
        INSERT INTO task_reference_images (
          id, task_id, file_path, file_url, original_name, mime_type, size_bytes, sort_order
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      db.exec("BEGIN");
      try {
        insertTask.run(
          taskId,
          input.provider,
          input.baseUrl,
          input.apiKey,
          input.model,
          input.prompt,
          input.size,
          input.count,
          input.outputDirectory,
          now,
          now
        );
        input.referenceImages.forEach((image, index) => {
          insertReference.run(
            crypto.randomUUID(),
            taskId,
            image.filePath,
            image.fileUrl,
            image.originalName,
            image.mimeType,
            image.sizeBytes,
            index
          );
        });
        db.exec("COMMIT");
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }

      return this.getTask(taskId) as GenerationTask;
    },

    listTasks(): GenerationTask[] {
      const rows = db.prepare("SELECT * FROM tasks ORDER BY datetime(created_at) DESC").all() as unknown as TaskRow[];
      return rows.map((row) => hydrateTask(db, row));
    },

    getTask(taskId: string): GenerationTask | undefined {
      const row = db.prepare("SELECT * FROM tasks WHERE id = ?").get(taskId) as TaskRow | undefined;
      return row ? hydrateTask(db, row) : undefined;
    },

    listQueuedTasks(limit: number): GenerationTask[] {
      const rows = db
        .prepare("SELECT * FROM tasks WHERE status = 'queued' ORDER BY datetime(created_at) ASC LIMIT ?")
        .all(limit) as unknown as TaskRow[];
      return rows.map((row) => hydrateTask(db, row));
    },

    markQueued(taskId: string, now = new Date().toISOString()): void {
      db.prepare("UPDATE tasks SET status = 'queued', updated_at = ?, error = NULL WHERE id = ?").run(now, taskId);
    },

    markRunning(taskId: string, now = new Date().toISOString()): void {
      db.prepare("UPDATE tasks SET status = 'running', started_at = ?, updated_at = ?, error = NULL WHERE id = ?").run(
        now,
        now,
        taskId
      );
    },

    markSucceeded(taskId: string, now = new Date().toISOString()): void {
      db.prepare("UPDATE tasks SET status = 'succeeded', completed_at = ?, updated_at = ?, error = NULL WHERE id = ?").run(
        now,
        now,
        taskId
      );
    },

    markFailed(taskId: string, error: string, now = new Date().toISOString()): void {
      db.prepare("UPDATE tasks SET status = 'failed', error = ?, completed_at = ?, updated_at = ? WHERE id = ?").run(
        error,
        now,
        now,
        taskId
      );
    },

    retryTask(taskId: string, now = new Date().toISOString()): void {
      db.prepare(
        "UPDATE tasks SET status = 'queued', error = NULL, started_at = NULL, completed_at = NULL, retry_count = retry_count + 1, updated_at = ? WHERE id = ?"
      ).run(now, taskId);
    },

    cancelTask(taskId: string, now = new Date().toISOString()): void {
      db.prepare("UPDATE tasks SET status = 'cancelled', completed_at = ?, updated_at = ? WHERE id = ?").run(
        now,
        now,
        taskId
      );
    },

    addOutput(taskId: string, output: TaskOutputRecord, now = new Date().toISOString()): void {
      db.prepare(
        "INSERT INTO task_outputs (id, task_id, file_path, file_url, revised_prompt, created_at) VALUES (?, ?, ?, ?, ?, ?)"
      ).run(output.id ?? crypto.randomUUID(), taskId, output.filePath, output.fileUrl, output.revisedPrompt ?? null, now);
    }
  };
}

function hydrateTask(db: AppDatabase, row: TaskRow): GenerationTask {
  return {
    id: row.id,
    status: row.status,
    provider: row.provider,
    baseUrl: row.base_url,
    apiKey: row.api_key,
    model: row.model,
    prompt: row.prompt,
    size: row.size,
    count: row.count,
    outputDirectory: row.output_directory,
    error: row.error ?? undefined,
    retryCount: row.retry_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    startedAt: row.started_at ?? undefined,
    completedAt: row.completed_at ?? undefined,
    referenceImages: listReferenceImages(db, row.id),
    outputs: listOutputs(db, row.id)
  };
}

function listReferenceImages(db: AppDatabase, taskId: string): ReferenceImageRecord[] {
  const rows = db
    .prepare("SELECT * FROM task_reference_images WHERE task_id = ? ORDER BY sort_order ASC")
    .all(taskId) as unknown as ReferenceRow[];

  return rows.map((row) => ({
    id: row.id,
    filePath: row.file_path,
    fileUrl: row.file_url,
    originalName: row.original_name,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes
  }));
}

function listOutputs(db: AppDatabase, taskId: string): TaskOutputRecord[] {
  const rows = db.prepare("SELECT * FROM task_outputs WHERE task_id = ? ORDER BY datetime(created_at) ASC").all(taskId) as unknown as OutputRow[];
  return rows.map((row) => ({
    id: row.id,
    filePath: row.file_path,
    fileUrl: row.file_url,
    revisedPrompt: row.revised_prompt ?? undefined,
    createdAt: row.created_at
  }));
}
