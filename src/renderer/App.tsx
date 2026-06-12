import {
  AlertCircle,
  Check,
  Download,
  FolderOpen,
  History,
  ImagePlus,
  KeyRound,
  Loader2,
  Save,
  Settings2,
  Sparkles
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { AppConfig, HistoryEntry, ProviderFormat, SavedImage } from "../shared/types";

const providerDefaults: Record<ProviderFormat, Pick<AppConfig["provider"], "baseUrl" | "model"> & { size: string }> = {
  openai: {
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-image-1",
    size: "1024x1024"
  },
  gemini: {
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    model: "gemini-2.5-flash-image",
    size: "1:1"
  }
};

const openAiSizes = ["1024x1024", "1024x1536", "1536x1024"];
const geminiRatios = ["1:1", "16:9", "9:16", "4:3", "3:4"];

export function App() {
  const [config, setConfig] = useState<AppConfig>();
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [selectedImages, setSelectedImages] = useState<SavedImage[]>([]);
  const [selectedHistoryId, setSelectedHistoryId] = useState<string>();
  const [isGenerating, setIsGenerating] = useState(false);
  const [status, setStatus] = useState("准备就绪");
  const [error, setError] = useState<string>();

  useEffect(() => {
    void bootstrap();
  }, []);

  const sizeOptions = useMemo(() => {
    if (!config) {
      return openAiSizes;
    }

    return config.provider.format === "gemini" ? geminiRatios : openAiSizes;
  }, [config]);

  async function bootstrap() {
    try {
      const [loadedConfig, loadedHistory] = await Promise.all([
        window.aiImageTool.loadConfig(),
        window.aiImageTool.loadHistory()
      ]);
      setConfig(loadedConfig);
      setHistory(loadedHistory);
      setSelectedImages(loadedHistory[0]?.images ?? []);
      setSelectedHistoryId(loadedHistory[0]?.id);
    } catch (loadError) {
      setError(toErrorMessage(loadError));
    }
  }

  function updateConfig(updater: (current: AppConfig) => AppConfig) {
    setConfig((current) => {
      if (!current) {
        return current;
      }

      return updater(current);
    });
  }

  function changeProvider(format: ProviderFormat) {
    updateConfig((current) => {
      const defaults = providerDefaults[format];
      return {
        ...current,
        size: defaults.size,
        provider: {
          ...current.provider,
          format,
          baseUrl: defaults.baseUrl,
          model: defaults.model
        }
      };
    });
  }

  async function saveConfig() {
    if (!config) {
      return;
    }

    setError(undefined);
    try {
      await window.aiImageTool.saveConfig(config);
      setStatus("配置已保存");
    } catch (saveError) {
      setError(toErrorMessage(saveError));
    }
  }

  async function chooseOutputDirectory() {
    const directory = await window.aiImageTool.chooseOutputDirectory();
    if (directory) {
      updateConfig((current) => ({ ...current, outputDirectory: directory }));
    }
  }

  async function openOutputDirectory() {
    if (config?.outputDirectory) {
      await window.aiImageTool.openOutputDirectory(config.outputDirectory);
    }
  }

  async function generateImages() {
    if (!config || isGenerating) {
      return;
    }

    setIsGenerating(true);
    setError(undefined);
    setStatus("正在生成");

    try {
      const result = await window.aiImageTool.generateImages(config);
      const refreshedHistory = await window.aiImageTool.loadHistory();
      setHistory(refreshedHistory);
      setSelectedImages(result.images);
      setSelectedHistoryId(result.historyEntry.id);
      setStatus(`已生成 ${result.images.length} 张图片`);
    } catch (generationError) {
      setError(toErrorMessage(generationError));
      setStatus("生成失败");
    } finally {
      setIsGenerating(false);
    }
  }

  function selectHistoryEntry(entry: HistoryEntry) {
    setSelectedHistoryId(entry.id);
    setSelectedImages(entry.images);
  }

  if (!config) {
    return (
      <main className="loading-screen">
        <Loader2 className="spin" size={28} />
        <span>正在载入</span>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <aside className="settings-pane">
        <header className="brand-row">
          <div className="brand-mark">
            <Sparkles size={20} />
          </div>
          <div>
            <h1>AI Image Tool</h1>
            <p>OpenAI / Gemini</p>
          </div>
        </header>

        <section className="control-section">
          <div className="section-title">
            <Settings2 size={16} />
            <span>接口配置</span>
          </div>

          <label>
            接口格式
            <select value={config.provider.format} onChange={(event) => changeProvider(event.target.value as ProviderFormat)}>
              <option value="openai">OpenAI Compatible</option>
              <option value="gemini">Gemini</option>
            </select>
          </label>

          <label>
            Base URL
            <input
              value={config.provider.baseUrl}
              onChange={(event) =>
                updateConfig((current) => ({
                  ...current,
                  provider: { ...current.provider, baseUrl: event.target.value }
                }))
              }
              spellCheck={false}
            />
          </label>

          <label>
            API Key
            <div className="input-with-icon">
              <KeyRound size={15} />
              <input
                type="password"
                value={config.provider.apiKey}
                onChange={(event) =>
                  updateConfig((current) => ({
                    ...current,
                    provider: { ...current.provider, apiKey: event.target.value }
                  }))
                }
                spellCheck={false}
              />
            </div>
          </label>

          <label>
            Model
            <input
              value={config.provider.model}
              onChange={(event) =>
                updateConfig((current) => ({
                  ...current,
                  provider: { ...current.provider, model: event.target.value }
                }))
              }
              spellCheck={false}
            />
          </label>
        </section>

        <section className="control-section">
          <div className="section-title">
            <ImagePlus size={16} />
            <span>生成参数</span>
          </div>

          <label>
            尺寸 / 比例
            <select value={config.size} onChange={(event) => updateConfig((current) => ({ ...current, size: event.target.value }))}>
              {sizeOptions.map((size) => (
                <option value={size} key={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>

          <label>
            数量
            <input
              type="number"
              min={1}
              max={4}
              value={config.count}
              onChange={(event) =>
                updateConfig((current) => ({
                  ...current,
                  count: Number(event.target.value)
                }))
              }
            />
          </label>

          <label>
            输出目录
            <div className="path-row">
              <input value={config.outputDirectory} readOnly title={config.outputDirectory} />
              <button className="icon-button" type="button" onClick={chooseOutputDirectory} title="选择目录">
                <FolderOpen size={16} />
              </button>
            </div>
          </label>

          <div className="button-grid">
            <button type="button" className="secondary-button" onClick={saveConfig}>
              <Save size={16} />
              保存配置
            </button>
            <button type="button" className="secondary-button" onClick={openOutputDirectory}>
              <FolderOpen size={16} />
              打开目录
            </button>
          </div>
        </section>
      </aside>

      <section className="workspace">
        <div className="prompt-panel">
          <div className="prompt-header">
            <div>
              <span className="eyebrow">Prompt</span>
              <h2>图像生成</h2>
            </div>
            <div className={`status-pill ${error ? "is-error" : ""}`}>
              {error ? <AlertCircle size={15} /> : <Check size={15} />}
              <span>{error ?? status}</span>
            </div>
          </div>

          <textarea
            value={config.prompt}
            onChange={(event) => updateConfig((current) => ({ ...current, prompt: event.target.value }))}
            placeholder="输入要生成的画面，例如：一瓶高端香水在湿润黑曜石台面上，柔和棚拍光，商业产品摄影"
          />

          <div className="action-row">
            <button type="button" className="primary-button" onClick={generateImages} disabled={isGenerating}>
              {isGenerating ? <Loader2 className="spin" size={18} /> : <Sparkles size={18} />}
              {isGenerating ? "生成中" : "开始生成"}
            </button>
            <span>{config.provider.format === "gemini" ? "Gemini 原生格式" : "OpenAI 兼容格式"}</span>
          </div>
        </div>

        <section className="preview-panel">
          <div className="panel-heading">
            <h2>预览</h2>
            <span>{selectedImages.length} 张</span>
          </div>

          {selectedImages.length === 0 ? (
            <div className="empty-preview">
              <ImagePlus size={42} />
              <span>暂无图片</span>
            </div>
          ) : (
            <div className="image-grid">
              {selectedImages.map((image) => (
                <figure className="image-tile" key={image.filePath}>
                  <img src={image.fileUrl} alt={image.revisedPrompt ?? config.prompt} />
                  <figcaption>
                    <span title={image.filePath}>{basename(image.filePath)}</span>
                    <button type="button" className="icon-button" onClick={openOutputDirectory} title="打开目录">
                      <Download size={15} />
                    </button>
                  </figcaption>
                </figure>
              ))}
            </div>
          )}
        </section>
      </section>

      <aside className="history-pane">
        <div className="panel-heading">
          <div className="section-title">
            <History size={16} />
            <span>历史记录</span>
          </div>
          <span>{history.length}</span>
        </div>

        <div className="history-list">
          {history.map((entry) => (
            <button
              type="button"
              key={entry.id}
              className={`history-item ${entry.id === selectedHistoryId ? "is-active" : ""}`}
              onClick={() => selectHistoryEntry(entry)}
            >
              <img src={entry.images[0]?.fileUrl} alt={entry.prompt} />
              <div>
                <strong>{entry.prompt}</strong>
                <span>
                  {entry.provider} / {entry.model}
                </span>
                <time>{formatTime(entry.createdAt)}</time>
              </div>
            </button>
          ))}
        </div>
      </aside>
    </main>
  );
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "发生未知错误";
}

function basename(filePath: string): string {
  return filePath.split(/[\\/]/).at(-1) ?? filePath;
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}
