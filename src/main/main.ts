import { app, BrowserWindow, dialog, ipcMain, shell, type OpenDialogOptions } from "electron";
import { join } from "node:path";
import type { CreateTaskInput, QueueSettings } from "../shared/types";
import { defaultWorkflowAppId, getWorkflowApp } from "../shared/workflowApps";
import { saveAnnotatedImage } from "./annotations";
import { openAppDatabase } from "./db";
import { logError } from "./logging";
import { importReferenceImages } from "./referenceImages";
import { createStorage } from "./storage";
import { createTaskRunner } from "./taskRunner";
import { createTaskStore } from "./taskStore";

let mainWindow: BrowserWindow | undefined;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 860,
    minWidth: 1120,
    minHeight: 720,
    backgroundColor: "#eef0ed",
    title: "AI Image Tool",
    webPreferences: {
      preload: join(__dirname, "../preload/preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (app.isPackaged) {
    void mainWindow.loadFile(join(__dirname, "../../dist/index.html"));
  } else {
    void mainWindow.loadURL("http://127.0.0.1:5173");
  }
}

function registerIpcHandlers(): void {
  const userDataPath = app.getPath("userData");
  const db = openAppDatabase(join(userDataPath, "app.sqlite"));
  const store = createTaskStore(db);
  let pumpPromise: Promise<void> | undefined;
  const runner = createTaskRunner(store, {
    concurrency: () => loadQueueSettingsSync(store, userDataPath).concurrency,
    onTaskChange: () => {
      mainWindow?.webContents.send("tasks:changed", store.listTasks());
    }
  });

  const pumpQueue = () => {
    if (!pumpPromise) {
      pumpPromise = runner
        .runUntilIdle()
        .catch((error) => logError(userDataPath, error))
        .finally(() => {
          pumpPromise = undefined;
          mainWindow?.webContents.send("tasks:changed", store.listTasks());
        });
    }

    return pumpPromise;
  };

  ipcMain.handle("settings:load", async () => loadQueueSettings(store, userDataPath));

  ipcMain.handle("settings:save", async (_event, settings: QueueSettings) => {
    store.setSetting("queueSettings", normalizeSettings(settings, userDataPath));
    return loadQueueSettingsSync(store, userDataPath);
  });

  ipcMain.handle("tasks:list", async () => store.listTasks());

  ipcMain.handle("tasks:enqueue", async (_event, input: CreateTaskInput) => {
    const task = store.createTask(input);
    mainWindow?.webContents.send("tasks:changed", store.listTasks());
    void pumpQueue();
    return task;
  });

  ipcMain.handle("tasks:retry", async (_event, taskId: string) => {
    runner.retryTask(taskId);
    mainWindow?.webContents.send("tasks:changed", store.listTasks());
    void pumpQueue();
  });

  ipcMain.handle("tasks:cancel", async (_event, taskId: string) => {
    runner.cancelTask(taskId);
    mainWindow?.webContents.send("tasks:changed", store.listTasks());
  });

  ipcMain.handle("outputs:saveAnnotation", async (_event, taskId: string, sourcePath: string, dataUrl: string) => {
    const saved = await saveAnnotatedImage(taskId, sourcePath, dataUrl, store);
    mainWindow?.webContents.send("tasks:changed", store.listTasks());
    return saved;
  });

  ipcMain.handle("references:choose", async () => {
    const dialogOptions: OpenDialogOptions = {
      properties: ["openFile", "multiSelections"],
      filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "webp"] }]
    };
    const result = mainWindow
      ? await dialog.showOpenDialog(mainWindow, dialogOptions)
      : await dialog.showOpenDialog(dialogOptions);
    if (result.canceled) {
      return [];
    }

    return importReferenceImages(result.filePaths, userDataPath);
  });

  ipcMain.handle("references:import", async (_event, filePaths: string[]) => {
    return importReferenceImages(filePaths, userDataPath);
  });

  ipcMain.handle("directory:choose", async () => {
    const dialogOptions: OpenDialogOptions = {
      properties: ["openDirectory", "createDirectory"]
    };
    const result = mainWindow
      ? await dialog.showOpenDialog(mainWindow, dialogOptions)
      : await dialog.showOpenDialog(dialogOptions);

    return result.canceled ? undefined : result.filePaths[0];
  });

  ipcMain.handle("directory:open", async (_event, directory: string) => {
    await shell.openPath(directory);
  });

  void pumpQueue();
}

async function loadQueueSettings(store: ReturnType<typeof createTaskStore>, userDataPath: string): Promise<QueueSettings> {
  const stored = store.getSetting<QueueSettings>("queueSettings");
  if (stored) {
    return normalizeSettings(stored, userDataPath);
  }

  const legacyConfig = await createStorage(userDataPath).loadConfig();
  const migrated = normalizeSettings(
    {
      provider: legacyConfig.provider,
      size: legacyConfig.size,
      count: legacyConfig.count,
      outputDirectory: legacyConfig.outputDirectory,
      concurrency: legacyConfig.concurrency ?? 2
    },
    userDataPath
  );
  store.setSetting("queueSettings", migrated);
  return migrated;
}

function loadQueueSettingsSync(store: ReturnType<typeof createTaskStore>, userDataPath: string): QueueSettings {
  return normalizeSettings(
    store.getSetting<QueueSettings>("queueSettings") ?? {
      provider: {
        format: "openai",
        baseUrl: "https://api.openai.com/v1",
        apiKey: "",
        model: "gpt-image-1"
      },
      size: "1024x1024",
      count: 1,
      outputDirectory: join(userDataPath, "outputs"),
      concurrency: 2
    },
    userDataPath
  );
}

function normalizeSettings(settings: QueueSettings, userDataPath: string): QueueSettings {
  if (settings.provider.format === "workflow") {
    const workflowAppId = getWorkflowApp(settings.provider.model)?.id ?? defaultWorkflowAppId;
    return {
      provider: {
        format: "workflow",
        baseUrl: "https://www.runninghub.cn/openapi/v2",
        apiKey: settings.provider.apiKey || "",
        model: workflowAppId
      },
      size: "workflow",
      count: 1,
      outputDirectory: settings.outputDirectory || join(userDataPath, "outputs"),
      concurrency: clampInteger(settings.concurrency, 1, 6, 2)
    };
  }

  return {
    provider: {
      format: settings.provider.format,
      baseUrl: settings.provider.baseUrl || "https://api.openai.com/v1",
      apiKey: settings.provider.apiKey || "",
      model: settings.provider.model || "gpt-image-1"
    },
    size: settings.size || "1024x1024",
    count: clampInteger(settings.count, 1, 4, 1),
    outputDirectory: settings.outputDirectory || join(userDataPath, "outputs"),
    concurrency: clampInteger(settings.concurrency, 1, 6, 2)
  };
}

function clampInteger(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, Math.floor(value)));
}

const gotSingleInstanceLock = app.requestSingleInstanceLock();

if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!mainWindow) {
      return;
    }

    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }

    mainWindow.focus();
  });

  app.whenReady().then(() => {
    registerIpcHandlers();
    createWindow();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      app.quit();
    }
  });
}
