import { contextBridge, ipcRenderer, webUtils } from "electron";
import type { CreateTaskInput, GenerationTask, QueueSettings, ReferenceImageRecord, SavedImage } from "../shared/types";

const api = {
  loadSettings: () => ipcRenderer.invoke("settings:load") as Promise<QueueSettings>,
  saveSettings: (settings: QueueSettings) => ipcRenderer.invoke("settings:save", settings) as Promise<QueueSettings>,
  listTasks: () => ipcRenderer.invoke("tasks:list") as Promise<GenerationTask[]>,
  enqueueTask: (input: CreateTaskInput) => ipcRenderer.invoke("tasks:enqueue", input) as Promise<GenerationTask>,
  retryTask: (taskId: string) => ipcRenderer.invoke("tasks:retry", taskId) as Promise<void>,
  cancelTask: (taskId: string) => ipcRenderer.invoke("tasks:cancel", taskId) as Promise<void>,
  saveAnnotatedImage: (taskId: string, sourcePath: string, dataUrl: string) =>
    ipcRenderer.invoke("outputs:saveAnnotation", taskId, sourcePath, dataUrl) as Promise<SavedImage>,
  chooseReferenceImages: () => ipcRenderer.invoke("references:choose") as Promise<ReferenceImageRecord[]>,
  importReferenceImages: (filePaths: string[]) =>
    ipcRenderer.invoke("references:import", filePaths) as Promise<ReferenceImageRecord[]>,
  getFilePath: (file: File) => webUtils.getPathForFile(file),
  chooseOutputDirectory: () => ipcRenderer.invoke("directory:choose") as Promise<string | undefined>,
  openOutputDirectory: (directory: string) => ipcRenderer.invoke("directory:open", directory) as Promise<void>,
  onTasksChanged: (callback: (tasks: GenerationTask[]) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, tasks: GenerationTask[]) => callback(tasks);
    ipcRenderer.on("tasks:changed", listener);
    return () => {
      ipcRenderer.removeListener("tasks:changed", listener);
    };
  }
};

contextBridge.exposeInMainWorld("aiImageTool", api);

export type AiImageToolApi = typeof api;
