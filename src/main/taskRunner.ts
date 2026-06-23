import type {
  GenerationTask,
  NormalizedGeneratedImage,
  ProviderGenerationResult,
  ProviderProgressStatus,
  SavedImage
} from "../shared/types";
import { saveGeneratedImages } from "./imageFiles";
import { generateWithProvider } from "./providers";
import type { TaskStore } from "./taskStore";

export interface TaskRunner {
  startQueuedTasks: () => number;
  runUntilIdle: () => Promise<void>;
  retryTask: (taskId: string) => void;
  cancelTask: (taskId: string) => void;
}

interface TaskRunnerOptions {
  concurrency: number | (() => number);
  generate?: (
    task: GenerationTask,
    signal: AbortSignal,
    reportStatus?: (status: ProviderProgressStatus) => void
  ) => Promise<ProviderGenerationResult>;
  saveImages?: (
    images: NormalizedGeneratedImage[],
    outputDirectory: string,
    task: GenerationTask
  ) => Promise<SavedImage[]>;
  onTaskChange?: (task: GenerationTask) => void;
}

export function createTaskRunner(store: TaskStore, options: TaskRunnerOptions): TaskRunner {
  const activeTasks = new Map<string, { promise: Promise<void>; controller: AbortController }>();
  const generate = options.generate ?? defaultGenerate;
  const saveImages = options.saveImages ?? defaultSaveImages;

  const runner: TaskRunner = {
    startQueuedTasks(): number {
      const availableSlots = Math.max(0, getConcurrency() - activeTasks.size);
      if (availableSlots === 0) {
        return 0;
      }

      const queuedTasks = store.listQueuedTasks(availableSlots);
      for (const task of queuedTasks) {
        const controller = new AbortController();
        const promise = runTask(task, controller).finally(() => {
          activeTasks.delete(task.id);
        });
        activeTasks.set(task.id, { promise, controller });
      }

      return queuedTasks.length;
    },

    async runUntilIdle(): Promise<void> {
      while (true) {
        this.startQueuedTasks();
        if (activeTasks.size === 0) {
          return;
        }

        await Promise.all(Array.from(activeTasks.values()).map((entry) => entry.promise));
      }
    },

    retryTask(taskId: string): void {
      store.retryTask(taskId);
      notify(taskId);
      this.startQueuedTasks();
    },

    cancelTask(taskId: string): void {
      const active = activeTasks.get(taskId);
      if (active) {
        active.controller.abort();
      }

      store.cancelTask(taskId);
      notify(taskId);
    }
  };

  async function runTask(task: GenerationTask, controller: AbortController): Promise<void> {
    store.markRunning(task.id);
    notify(task.id);
    try {
      const providerResult = await generate(task, controller.signal, (status) => {
        if (controller.signal.aborted || store.getTask(task.id)?.status === "cancelled") {
          return;
        }

        if (status === "queued") {
          store.markQueued(task.id);
        } else {
          store.markRunning(task.id);
        }
        notify(task.id);
      });
      if (controller.signal.aborted || store.getTask(task.id)?.status === "cancelled") {
        return;
      }

      const savedImages = await saveImages(providerResult.images, task.outputDirectory, task);
      for (const image of savedImages) {
        store.addOutput(task.id, image);
      }
      store.markSucceeded(task.id);
      notify(task.id);
    } catch (error) {
      if (controller.signal.aborted || store.getTask(task.id)?.status === "cancelled") {
        return;
      }

      store.markFailed(task.id, toErrorMessage(error));
      notify(task.id);
    }
  }

  function notify(taskId: string): void {
    const task = store.getTask(taskId);
    if (task) {
      options.onTaskChange?.(task);
    }
  }

  return runner;

  function getConcurrency(): number {
    const value = typeof options.concurrency === "function" ? options.concurrency() : options.concurrency;
    return Math.max(1, Math.floor(value));
  }
}

async function defaultGenerate(
  task: GenerationTask,
  _signal?: AbortSignal,
  reportStatus?: (status: ProviderProgressStatus) => void
): Promise<ProviderGenerationResult> {
  return generateWithProvider({
    provider: {
      format: task.provider,
      baseUrl: task.baseUrl,
      apiKey: task.apiKey,
      model: task.model
    },
    prompt: task.prompt,
    size: task.size,
    count: task.count,
    referenceImages: task.referenceImages
  }, undefined, undefined, reportStatus);
}

async function defaultSaveImages(
  images: NormalizedGeneratedImage[],
  outputDirectory: string
): Promise<SavedImage[]> {
  return saveGeneratedImages(images, outputDirectory);
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
