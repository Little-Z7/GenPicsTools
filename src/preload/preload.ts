import { contextBridge, ipcRenderer } from "electron";
import type { AppConfig, GenerationResult, HistoryEntry } from "../shared/types";

const api = {
  loadConfig: () => ipcRenderer.invoke("config:load") as Promise<AppConfig>,
  saveConfig: (config: AppConfig) => ipcRenderer.invoke("config:save", config) as Promise<AppConfig>,
  loadHistory: () => ipcRenderer.invoke("history:load") as Promise<HistoryEntry[]>,
  chooseOutputDirectory: () => ipcRenderer.invoke("directory:choose") as Promise<string | undefined>,
  openOutputDirectory: (directory: string) => ipcRenderer.invoke("directory:open", directory) as Promise<void>,
  generateImages: (config: AppConfig) => ipcRenderer.invoke("images:generate", config) as Promise<GenerationResult>
};

contextBridge.exposeInMainWorld("aiImageTool", api);

export type AiImageToolApi = typeof api;
