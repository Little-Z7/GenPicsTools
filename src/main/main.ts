import { app, BrowserWindow, dialog, ipcMain, shell, type OpenDialogOptions } from "electron";
import { join } from "node:path";
import type { AppConfig } from "../shared/types";
import { generateAndPersistImages } from "./generationWorkflow";
import { logError } from "./logging";
import { createStorage } from "./storage";

let mainWindow: BrowserWindow | undefined;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1040,
    minHeight: 700,
    backgroundColor: "#f4f1eb",
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
  const storage = createStorage(app.getPath("userData"));

  ipcMain.handle("config:load", async () => storage.loadConfig());

  ipcMain.handle("config:save", async (_event, config: AppConfig) => {
    await storage.saveConfig(config);
    return config;
  });

  ipcMain.handle("history:load", async () => storage.loadHistory());

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

  ipcMain.handle("images:generate", async (_event, config: AppConfig) => {
    try {
      await storage.saveConfig(config);
      return await generateAndPersistImages(config, storage);
    } catch (error) {
      await logError(app.getPath("userData"), error);
      throw error;
    }
  });
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
