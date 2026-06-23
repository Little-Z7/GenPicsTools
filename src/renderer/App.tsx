import {
  AlertCircle,
  ArrowUpRight,
  Ban,
  Brush,
  CheckCircle2,
  FolderOpen,
  History,
  ImagePlus,
  KeyRound,
  Loader2,
  Play,
  RotateCcw,
  Save,
  Settings2,
  Square,
  Sparkles,
  Trash2,
  Type,
  Undo2,
  Upload,
  X
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { isPreviewableImageOutput } from "../shared/outputFiles";
import { createRegenerateTaskInput } from "../shared/regenerateTask";
import { getSizeOptions, isPresetSize } from "../shared/sizeOptions";
import type {
  GenerationTask,
  ProviderFormat,
  QueueSettings,
  ReferenceImageRecord,
  TaskOutputRecord,
  TaskStatus
} from "../shared/types";

const providerDefaults: Record<ProviderFormat, Pick<QueueSettings["provider"], "baseUrl" | "model"> & { size: string }> = {
  openai: {
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-image-1",
    size: "1024x1024"
  },
  gemini: {
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    model: "gemini-2.5-flash-image",
    size: "1:1"
  },
  workflow: {
    baseUrl: "https://www.runninghub.cn/openapi/v2",
    model: "seethrough",
    size: "workflow"
  }
};

const customSizeOptionValue = "__custom__";

const statusText: Record<TaskStatus, string> = {
  queued: "等待中",
  running: "生成中",
  succeeded: "已完成",
  failed: "失败",
  cancelled: "已取消"
};

export function App() {
  const [settings, setSettings] = useState<QueueSettings>();
  const [prompt, setPrompt] = useState("");
  const [referenceImages, setReferenceImages] = useState<ReferenceImageRecord[]>([]);
  const [tasks, setTasks] = useState<GenerationTask[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string>();
  const [error, setError] = useState<string>();
  const [status, setStatus] = useState("准备就绪");
  const [isImporting, setIsImporting] = useState(false);
  const [isEnqueueing, setIsEnqueueing] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  const [regeneratingTaskId, setRegeneratingTaskId] = useState<string>();

  useEffect(() => {
    void bootstrap();
    const unsubscribe = window.aiImageTool.onTasksChanged((nextTasks) => {
      setTasks(nextTasks);
      setSelectedTaskId((current) => current ?? nextTasks[0]?.id);
    });
    return unsubscribe;
  }, []);

  const selectedTask = useMemo(
    () => tasks.find((task) => task.id === selectedTaskId) ?? tasks[0],
    [selectedTaskId, tasks]
  );

  const sizeOptions = settings ? getSizeOptions(settings.provider.format) : [];
  const selectedSizeOption =
    settings && isPresetSize(settings.provider.format, settings.size) ? settings.size : customSizeOptionValue;
  const isWorkflowMode = settings?.provider.format === "workflow";
  const canEnqueue =
    !!settings &&
    (isWorkflowMode
      ? settings.provider.apiKey.trim().length > 0 && referenceImages.length > 0
      : prompt.trim().length > 0);

  async function bootstrap() {
    try {
      const [loadedSettings, loadedTasks] = await Promise.all([
        window.aiImageTool.loadSettings(),
        window.aiImageTool.listTasks()
      ]);
      setSettings(loadedSettings);
      setTasks(loadedTasks);
      setSelectedTaskId(loadedTasks[0]?.id);
    } catch (loadError) {
      setError(toErrorMessage(loadError));
    }
  }

  function updateSettings(updater: (current: QueueSettings) => QueueSettings) {
    setSettings((current) => (current ? updater(current) : current));
  }

  function changeProvider(format: ProviderFormat) {
    updateSettings((current) => {
      const defaults = providerDefaults[format];
      return {
        ...current,
        size: defaults.size,
        count: format === "workflow" ? 1 : current.count,
        provider: {
          ...current.provider,
          format,
          baseUrl: defaults.baseUrl,
          model: defaults.model
        }
      };
    });
  }

  async function saveSettings() {
    if (!settings) {
      return;
    }

    try {
      setError(undefined);
      const saved = await window.aiImageTool.saveSettings(settings);
      setSettings(saved);
      setStatus("配置已保存");
    } catch (saveError) {
      setError(toErrorMessage(saveError));
    }
  }

  async function chooseOutputDirectory() {
    const directory = await window.aiImageTool.chooseOutputDirectory();
    if (directory) {
      updateSettings((current) => ({ ...current, outputDirectory: directory }));
    }
  }

  async function chooseReferenceImages() {
    try {
      setIsImporting(true);
      const imported = await window.aiImageTool.chooseReferenceImages();
      setReferenceImages((current) => {
        const nextImages = dedupeReferences([...current, ...imported]);
        return settings?.provider.format === "workflow" ? nextImages.slice(0, 1) : nextImages;
      });
    } catch (importError) {
      setError(toErrorMessage(importError));
    } finally {
      setIsImporting(false);
    }
  }

  async function importDroppedFiles(files: FileList) {
    const filePaths = Array.from(files)
      .map((file) => window.aiImageTool.getFilePath(file))
      .filter(Boolean);
    if (filePaths.length === 0) {
      return;
    }

    try {
      setIsImporting(true);
      const imported = await window.aiImageTool.importReferenceImages(filePaths);
      setReferenceImages((current) => {
        const nextImages = dedupeReferences([...current, ...imported]);
        return settings?.provider.format === "workflow" ? nextImages.slice(0, 1) : nextImages;
      });
    } catch (importError) {
      setError(toErrorMessage(importError));
    } finally {
      setIsImporting(false);
      setIsDragActive(false);
    }
  }

  async function enqueueTask() {
    if (!settings || isEnqueueing) {
      return;
    }

    try {
      setError(undefined);
      setIsEnqueueing(true);
      await window.aiImageTool.saveSettings(settings);
      if (settings.provider.format === "workflow" && referenceImages.length === 0) {
        throw new Error("SeeThrough分层需要上传 1 张图片。");
      }
      const task = await window.aiImageTool.enqueueTask({
        provider: settings.provider.format,
        baseUrl: settings.provider.baseUrl,
        apiKey: settings.provider.apiKey,
        model: settings.provider.model,
        prompt: prompt.trim() || (settings.provider.format === "workflow" ? "SeeThrough分层" : prompt),
        size: settings.size,
        count: settings.count,
        outputDirectory: settings.outputDirectory,
        referenceImages: settings.provider.format === "workflow" ? referenceImages.slice(0, 1) : referenceImages
      });
      setTasks(await window.aiImageTool.listTasks());
      setSelectedTaskId(task.id);
      setStatus("任务已加入队列");
      setReferenceImages([]);
    } catch (enqueueError) {
      setError(toErrorMessage(enqueueError));
    } finally {
      setIsEnqueueing(false);
    }
  }

  async function retryTask(taskId: string) {
    await window.aiImageTool.retryTask(taskId);
    setTasks(await window.aiImageTool.listTasks());
  }

  async function cancelTask(taskId: string) {
    await window.aiImageTool.cancelTask(taskId);
    setTasks(await window.aiImageTool.listTasks());
  }

  async function refreshTasks() {
    setTasks(await window.aiImageTool.listTasks());
  }

  async function regenerateTask(task: GenerationTask) {
    if (regeneratingTaskId) {
      return;
    }

    try {
      setError(undefined);
      setRegeneratingTaskId(task.id);
      const regenerated = await window.aiImageTool.enqueueTask(createRegenerateTaskInput(task));
      setTasks(await window.aiImageTool.listTasks());
      setSelectedTaskId(regenerated.id);
      setStatus("已创建重新生成任务");
    } catch (regenerateError) {
      setError(toErrorMessage(regenerateError));
    } finally {
      setRegeneratingTaskId(undefined);
    }
  }

  if (!settings) {
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
            <p>SQLite Queue</p>
          </div>
        </header>

        <section className="control-section">
          <SectionTitle icon={<Settings2 size={16} />} text="接口配置" />

          <label>
            接口格式
	            <select value={settings.provider.format} onChange={(event) => changeProvider(event.target.value as ProviderFormat)}>
	              <option value="openai">OpenAI Compatible</option>
	              <option value="gemini">Gemini</option>
	              <option value="workflow">Workflow</option>
	            </select>
	          </label>

	          {!isWorkflowMode ? (
	            <label>
	              Base URL
	              <input
	                value={settings.provider.baseUrl}
	                onChange={(event) =>
	                  updateSettings((current) => ({
	                    ...current,
	                    provider: { ...current.provider, baseUrl: event.target.value }
	                  }))
	                }
	                spellCheck={false}
	              />
	            </label>
	          ) : null}

          <label>
            API Key
            <div className="input-with-icon">
              <KeyRound size={15} />
              <input
                type="password"
                value={settings.provider.apiKey}
                onChange={(event) =>
                  updateSettings((current) => ({
                    ...current,
                    provider: { ...current.provider, apiKey: event.target.value }
                  }))
                }
                spellCheck={false}
              />
            </div>
          </label>

	          {!isWorkflowMode ? (
	            <label>
	              Model
	              <input
	                value={settings.provider.model}
	                onChange={(event) =>
	                  updateSettings((current) => ({
	                    ...current,
	                    provider: { ...current.provider, model: event.target.value }
	                  }))
	                }
	                spellCheck={false}
	              />
	            </label>
	          ) : (
	            <label>
	              工作流应用
	              <input value="SeeThrough分层" readOnly />
	            </label>
	          )}
        </section>

        <section className="control-section">
          <SectionTitle icon={<ImagePlus size={16} />} text="任务参数" />

	          {!isWorkflowMode ? (
	            <label>
	              尺寸 / 比例
	              <div className="size-picker">
	                <select
	                  value={selectedSizeOption}
	                  onChange={(event) => {
	                    if (event.target.value !== customSizeOptionValue) {
	                      updateSettings((current) => ({ ...current, size: event.target.value }));
	                    }
	                  }}
	                >
	                  {sizeOptions.map((size) => (
	                    <option key={size} value={size}>
	                      {size}
	                    </option>
	                  ))}
	                  <option value={customSizeOptionValue}>自定义</option>
	                </select>
	                <input
	                  value={settings.size}
	                  onChange={(event) => updateSettings((current) => ({ ...current, size: event.target.value.trim() }))}
	                  placeholder={settings.provider.format === "gemini" ? "例如 7:5" : "例如 640x960"}
	                  spellCheck={false}
	                />
	              </div>
	            </label>
	          ) : null}

	          <div className="two-columns">
	            {!isWorkflowMode ? (
	              <label>
	                数量
	                <input
	                  type="number"
	                  min={1}
	                  max={4}
	                  value={settings.count}
	                  onChange={(event) => updateSettings((current) => ({ ...current, count: Number(event.target.value) }))}
	                />
	              </label>
	            ) : null}
	            <label>
	              并发
              <input
                type="number"
                min={1}
                max={6}
                value={settings.concurrency}
                onChange={(event) =>
                  updateSettings((current) => ({ ...current, concurrency: Number(event.target.value) }))
                }
              />
            </label>
          </div>

          <label>
            输出目录
            <div className="path-row">
              <input value={settings.outputDirectory} readOnly title={settings.outputDirectory} />
              <button className="icon-button" type="button" onClick={chooseOutputDirectory} title="选择目录">
                <FolderOpen size={16} />
              </button>
            </div>
          </label>

          <div className="button-grid">
            <button type="button" className="secondary-button" onClick={saveSettings}>
              <Save size={16} />
              保存
            </button>
            <button type="button" className="secondary-button" onClick={() => window.aiImageTool.openOutputDirectory(settings.outputDirectory)}>
              <FolderOpen size={16} />
              打开目录
            </button>
          </div>
        </section>
      </aside>

      <section className="workspace">
        <section className="prompt-panel">
          <div className="prompt-header">
            <div>
              <span className="eyebrow">Prompt</span>
              <h2>创建生成任务</h2>
            </div>
            <div className={`status-pill ${error ? "is-error" : ""}`}>
              {error ? <AlertCircle size={15} /> : <CheckCircle2 size={15} />}
              <span>{error ?? status}</span>
            </div>
          </div>

	          <textarea
	            value={prompt}
	            onChange={(event) => setPrompt(event.target.value)}
	            placeholder={isWorkflowMode ? "可选：给这次 SeeThrough 分层任务写一个备注。" : "输入提示词。可拖拽参考图到下方区域后一起提交到任务队列。"}
	          />

          <div
            className={`dropzone ${isDragActive ? "is-active" : ""}`}
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragActive(true);
            }}
            onDragLeave={() => setIsDragActive(false)}
            onDrop={(event) => {
              event.preventDefault();
              void importDroppedFiles(event.dataTransfer.files);
            }}
          >
            <Upload size={22} />
            <div>
	              <strong>{isWorkflowMode ? "输入图片" : "参考图"}</strong>
	              <span>{isWorkflowMode ? "SeeThrough分层需要 1 张 PNG / JPG / WebP 图片" : "拖拽 PNG / JPG / WebP 到这里，或点击选择文件"}</span>
            </div>
            <button type="button" className="secondary-button compact" onClick={chooseReferenceImages} disabled={isImporting}>
              {isImporting ? <Loader2 className="spin" size={15} /> : <ImagePlus size={15} />}
              选择
            </button>
          </div>

          {referenceImages.length > 0 && (
            <div className="reference-strip">
              {referenceImages.map((image) => (
                <figure key={image.id} className="reference-thumb">
                  <img src={image.fileUrl} alt={image.originalName} />
                  <button
                    type="button"
                    className="mini-remove"
                    onClick={() => setReferenceImages((current) => current.filter((item) => item.id !== image.id))}
                    title="移除"
                  >
                    <X size={12} />
                  </button>
                </figure>
              ))}
            </div>
          )}

          <div className="action-row">
            <button type="button" className="primary-button" onClick={enqueueTask} disabled={!canEnqueue || isEnqueueing}>
	              {isEnqueueing ? <Loader2 className="spin" size={18} /> : <Play size={18} />}
	              加入队列
	            </button>
	            <span>
	              {isWorkflowMode
	                ? referenceImages.length > 0
	                  ? "SeeThrough分层输入已就绪"
	                  : "需要上传 1 张图片"
	                : referenceImages.length > 0
	                  ? `${referenceImages.length} 张参考图`
	                  : "纯文本生图"}
	            </span>
          </div>
        </section>

        <section className="preview-panel">
          <div className="panel-heading">
            <h2>任务详情</h2>
            <div className="detail-actions">
              {selectedTask ? (
                <button
                  type="button"
                  className="secondary-button compact"
                  onClick={() => void regenerateTask(selectedTask)}
                  disabled={regeneratingTaskId === selectedTask.id}
                  title="复制当前任务参数并重新加入队列"
                >
                  {regeneratingTaskId === selectedTask.id ? (
                    <Loader2 className="spin" size={15} />
                  ) : (
                    <RotateCcw size={15} />
                  )}
                  重新生成
                </button>
              ) : null}
              <span>{selectedTask ? statusText[selectedTask.status] : "未选择"}</span>
            </div>
          </div>

          {!selectedTask ? (
            <div className="empty-preview">
              <History size={42} />
              <span>暂无任务</span>
            </div>
          ) : (
            <TaskDetail task={selectedTask} onTasksRefresh={refreshTasks} />
          )}
        </section>
      </section>

      <aside className="history-pane">
        <div className="panel-heading">
          <SectionTitle icon={<History size={16} />} text="任务队列" />
          <span>{tasks.length}</span>
        </div>

        <div className="queue-list">
          {tasks.map((task) => (
            <button
              key={task.id}
              type="button"
              className={`task-card ${task.id === selectedTask?.id ? "is-active" : ""} status-${task.status}`}
              onClick={() => setSelectedTaskId(task.id)}
            >
              <StatusIcon status={task.status} />
              <div>
	                <strong>{task.prompt}</strong>
	                <span>
	                  {statusText[task.status]} / {formatProviderName(task.provider)} / {formatModelName(task)}
	                </span>
	                <time>{formatTime(task.updatedAt)}</time>
              </div>
              <div className="task-actions">
                {task.status === "failed" || task.status === "cancelled" ? (
                  <button type="button" className="icon-button small" onClick={(event) => {
                    event.stopPropagation();
                    void retryTask(task.id);
                  }} title="重试">
                    <RotateCcw size={14} />
                  </button>
                ) : null}
                {task.status === "queued" || task.status === "running" ? (
                  <button type="button" className="icon-button small" onClick={(event) => {
                    event.stopPropagation();
                    void cancelTask(task.id);
                  }} title="取消">
                    <Ban size={14} />
                  </button>
                ) : null}
              </div>
            </button>
          ))}
        </div>
      </aside>
    </main>
  );
}

function TaskDetail({ task, onTasksRefresh }: { task: GenerationTask; onTasksRefresh: () => Promise<void> }) {
  const [editingImage, setEditingImage] = useState<TaskOutputRecord>();

  return (
    <div className="task-detail">
      <div className="detail-block">
        <span className="eyebrow">Prompt</span>
        <p>{task.prompt}</p>
      </div>

      {task.error && (
        <div className="error-box">
          <AlertCircle size={16} />
          <span>{task.error}</span>
        </div>
      )}

      {task.referenceImages.length > 0 && (
        <div className="detail-block">
          <div className="panel-heading tight">
            <h3>参考图</h3>
            <span>{task.referenceImages.length}</span>
          </div>
          <div className="reference-strip">
            {task.referenceImages.map((image) => (
              <figure key={image.id} className="reference-thumb large">
                <img src={image.fileUrl} alt={image.originalName} />
              </figure>
            ))}
          </div>
        </div>
      )}

      <div className="detail-block">
        <div className="panel-heading tight">
          <h3>输出图</h3>
          <span>{task.outputs.length}</span>
        </div>
        {task.outputs.length === 0 ? (
          <div className="empty-preview compact-empty">
            <ImagePlus size={32} />
            <span>暂无输出</span>
          </div>
	        ) : (
	          <div className="image-grid">
	            {task.outputs.map((image) =>
	              isPreviewableImageOutput(image.filePath) ? (
	                <figure className="image-tile" key={image.filePath}>
	                  <img src={image.fileUrl} alt={task.prompt} />
	                  <figcaption>
	                    <span title={image.filePath}>{basename(image.filePath)}</span>
	                    <button
	                      type="button"
	                      className="icon-button small"
	                      onClick={() => setEditingImage(image)}
	                      title="标注处理"
	                    >
	                      <Brush size={14} />
	                    </button>
	                  </figcaption>
	                </figure>
	              ) : (
	                <div className="file-tile" key={image.filePath}>
	                  <div className="file-icon">
	                    <FolderOpen size={26} />
	                  </div>
	                  <strong title={image.filePath}>{basename(image.filePath)}</strong>
	                  <a className="secondary-button compact file-download" href={image.fileUrl} download>
	                    下载
	                  </a>
	                </div>
	              )
	            )}
	          </div>
	        )}
      </div>

      {editingImage ? (
        <AnnotationEditor
          image={editingImage}
          task={task}
          onClose={() => setEditingImage(undefined)}
          onSaved={async () => {
            await onTasksRefresh();
            setEditingImage(undefined);
          }}
        />
      ) : null}
    </div>
  );
}

type AnnotationTool = "brush" | "arrow" | "rect" | "text" | "cover";

interface Point {
  x: number;
  y: number;
}

const annotationTools: Array<{ icon: ReactNode; id: AnnotationTool; label: string }> = [
  { id: "brush", label: "画笔", icon: <Brush size={16} /> },
  { id: "arrow", label: "箭头", icon: <ArrowUpRight size={16} /> },
  { id: "rect", label: "矩形", icon: <Square size={16} /> },
  { id: "text", label: "文字", icon: <Type size={16} /> },
  { id: "cover", label: "遮挡", icon: <Trash2 size={16} /> }
];

function AnnotationEditor({
  image,
  task,
  onClose,
  onSaved
}: {
  image: TaskOutputRecord;
  task: GenerationTask;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const baseImageRef = useRef<HTMLImageElement | null>(null);
  const drawingRef = useRef(false);
  const historyRef = useRef<ImageData[]>([]);
  const previewSnapshotRef = useRef<ImageData | null>(null);
  const startPointRef = useRef<Point | null>(null);
  const [tool, setTool] = useState<AnnotationTool>("brush");
  const [historyLength, setHistoryLength] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    setIsReady(false);
    setError(undefined);
    historyRef.current = [];
    setHistoryLength(0);

    const baseImage = new Image();
    baseImage.onload = () => {
      const context = canvas.getContext("2d");
      if (!context) {
        setError("无法初始化画布");
        return;
      }

      canvas.width = Math.max(1, baseImage.naturalWidth || baseImage.width);
      canvas.height = Math.max(1, baseImage.naturalHeight || baseImage.height);
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(baseImage, 0, 0, canvas.width, canvas.height);
      baseImageRef.current = baseImage;
      setIsReady(true);
    };
    baseImage.onerror = () => setError("图片加载失败");
    baseImage.src = image.fileUrl;

    return () => {
      baseImage.onload = null;
      baseImage.onerror = null;
    };
  }, [image.fileUrl]);

  function pushHistory() {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context || canvas.width === 0 || canvas.height === 0) {
      return;
    }

    historyRef.current = [...historyRef.current.slice(-19), context.getImageData(0, 0, canvas.width, canvas.height)];
    setHistoryLength(historyRef.current.length);
  }

  function undo() {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    const previous = historyRef.current.pop();
    if (!canvas || !context || !previous) {
      return;
    }

    context.putImageData(previous, 0, 0);
    setHistoryLength(historyRef.current.length);
  }

  function clearCanvas() {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    const baseImage = baseImageRef.current;
    if (!canvas || !context || !baseImage) {
      return;
    }

    pushHistory();
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(baseImage, 0, 0, canvas.width, canvas.height);
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!isReady) {
      return;
    }

    const canvas = event.currentTarget;
    const context = canvas.getContext("2d");
    if (!context) {
      setError("无法初始化画布");
      return;
    }

    const point = canvasPoint(event, canvas);

    if (tool === "text") {
      const text = window.prompt("输入标注文字");
      if (text?.trim()) {
        pushHistory();
        drawText(context, canvas, point, text.trim());
      }
      return;
    }

    pushHistory();
    drawingRef.current = true;
    startPointRef.current = point;
    previewSnapshotRef.current = context.getImageData(0, 0, canvas.width, canvas.height);
    canvas.setPointerCapture(event.pointerId);

    if (tool === "brush") {
      applyStrokeStyle(context, canvas);
      context.beginPath();
      context.moveTo(point.x, point.y);
    }
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) {
      return;
    }

    const canvas = event.currentTarget;
    const context = canvas.getContext("2d");
    const startPoint = startPointRef.current;
    if (!context || !startPoint) {
      return;
    }

    const point = canvasPoint(event, canvas);
    if (tool === "brush") {
      applyStrokeStyle(context, canvas);
      context.lineTo(point.x, point.y);
      context.stroke();
      return;
    }

    if (previewSnapshotRef.current) {
      context.putImageData(previewSnapshotRef.current, 0, 0);
    }
    drawShape(context, canvas, tool, startPoint, point);
  }

  function finishDrawing(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) {
      return;
    }

    const canvas = event.currentTarget;
    const context = canvas.getContext("2d");
    const startPoint = startPointRef.current;
    if (context && startPoint && tool !== "brush") {
      const point = canvasPoint(event, canvas);
      if (previewSnapshotRef.current) {
        context.putImageData(previewSnapshotRef.current, 0, 0);
      }
      drawShape(context, canvas, tool, startPoint, point);
    }

    drawingRef.current = false;
    startPointRef.current = null;
    previewSnapshotRef.current = null;
    if (canvas.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }
  }

  async function saveAnnotation() {
    const canvas = canvasRef.current;
    if (!canvas || isSaving) {
      return;
    }

    try {
      setError(undefined);
      setIsSaving(true);
      await window.aiImageTool.saveAnnotatedImage(task.id, image.filePath, canvas.toDataURL("image/png"));
      await onSaved();
    } catch (saveError) {
      setError(toErrorMessage(saveError));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="annotation-modal" role="dialog" aria-modal="true">
      <div className="annotation-shell">
        <header className="annotation-header">
          <div>
            <h3>标注图片</h3>
            <span title={image.filePath}>{basename(image.filePath)}</span>
          </div>
          <button type="button" className="icon-button" onClick={onClose} title="关闭">
            <X size={16} />
          </button>
        </header>

        <div className="annotation-toolbar">
          {annotationTools.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`tool-button ${tool === item.id ? "is-active" : ""}`}
              onClick={() => setTool(item.id)}
              title={item.label}
              aria-label={item.label}
            >
              {item.icon}
            </button>
          ))}
          <span className="toolbar-divider" />
          <button type="button" className="tool-button" onClick={undo} disabled={historyLength === 0} title="撤销" aria-label="撤销">
            <Undo2 size={16} />
          </button>
          <button type="button" className="tool-button" onClick={clearCanvas} disabled={!isReady} title="清除标注" aria-label="清除标注">
            <Trash2 size={16} />
          </button>
          <button type="button" className="secondary-button compact" onClick={saveAnnotation} disabled={!isReady || isSaving}>
            {isSaving ? <Loader2 className="spin" size={15} /> : <Save size={15} />}
            保存
          </button>
        </div>

        {error ? (
          <div className="error-box">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        ) : null}

        <div className="annotation-canvas-wrap">
          {!isReady ? (
            <div className="canvas-loading">
              <Loader2 className="spin" size={20} />
              <span>载入图片</span>
            </div>
          ) : null}
          <canvas
            ref={canvasRef}
            className="annotation-canvas"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={finishDrawing}
            onPointerCancel={finishDrawing}
            style={{ cursor: tool === "text" ? "text" : tool === "brush" ? "crosshair" : "crosshair" }}
          />
        </div>
      </div>
    </div>
  );
}

function canvasPoint(event: ReactPointerEvent<HTMLCanvasElement>, canvas: HTMLCanvasElement): Point {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * canvas.width,
    y: ((event.clientY - rect.top) / rect.height) * canvas.height
  };
}

function applyStrokeStyle(context: CanvasRenderingContext2D, canvas: HTMLCanvasElement) {
  context.strokeStyle = "#e43f2d";
  context.fillStyle = "#e43f2d";
  context.lineWidth = Math.max(4, Math.round(Math.max(canvas.width, canvas.height) / 260));
  context.lineCap = "round";
  context.lineJoin = "round";
}

function drawShape(
  context: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  tool: AnnotationTool,
  start: Point,
  end: Point
) {
  if (tool === "rect") {
    applyStrokeStyle(context, canvas);
    const rect = normalizeRect(start, end);
    context.strokeRect(rect.x, rect.y, rect.width, rect.height);
    return;
  }

  if (tool === "cover") {
    const rect = normalizeRect(start, end);
    context.fillStyle = "rgba(20, 24, 22, 0.74)";
    context.fillRect(rect.x, rect.y, rect.width, rect.height);
    return;
  }

  if (tool === "arrow") {
    drawArrow(context, canvas, start, end);
  }
}

function drawArrow(context: CanvasRenderingContext2D, canvas: HTMLCanvasElement, start: Point, end: Point) {
  applyStrokeStyle(context, canvas);
  const angle = Math.atan2(end.y - start.y, end.x - start.x);
  const headLength = Math.max(16, Math.round(Math.max(canvas.width, canvas.height) / 36));

  context.beginPath();
  context.moveTo(start.x, start.y);
  context.lineTo(end.x, end.y);
  context.stroke();

  context.beginPath();
  context.moveTo(end.x, end.y);
  context.lineTo(end.x - headLength * Math.cos(angle - Math.PI / 6), end.y - headLength * Math.sin(angle - Math.PI / 6));
  context.lineTo(end.x - headLength * Math.cos(angle + Math.PI / 6), end.y - headLength * Math.sin(angle + Math.PI / 6));
  context.closePath();
  context.fill();
}

function drawText(context: CanvasRenderingContext2D, canvas: HTMLCanvasElement, point: Point, text: string) {
  const fontSize = Math.max(24, Math.round(Math.max(canvas.width, canvas.height) / 24));
  context.font = `800 ${fontSize}px "Microsoft YaHei UI", "Segoe UI", sans-serif`;
  context.lineJoin = "round";
  context.lineWidth = Math.max(5, Math.round(fontSize / 7));
  context.strokeStyle = "#ffffff";
  context.strokeText(text, point.x, point.y);
  context.fillStyle = "#e43f2d";
  context.fillText(text, point.x, point.y);
}

function normalizeRect(start: Point, end: Point): { height: number; width: number; x: number; y: number } {
  return {
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y)
  };
}

function StatusIcon({ status }: { status: TaskStatus }) {
  if (status === "running") {
    return <Loader2 className="spin" size={18} />;
  }

  if (status === "succeeded") {
    return <CheckCircle2 size={18} />;
  }

  if (status === "failed") {
    return <AlertCircle size={18} />;
  }

  if (status === "cancelled") {
    return <Ban size={18} />;
  }

  return <History size={18} />;
}

function SectionTitle({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <div className="section-title">
      {icon}
      <span>{text}</span>
    </div>
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

function dedupeReferences(images: ReferenceImageRecord[]): ReferenceImageRecord[] {
  return Array.from(new Map(images.map((image) => [image.filePath, image])).values());
}

function basename(filePath: string): string {
  return filePath.split(/[\\/]/).at(-1) ?? filePath;
}

function formatProviderName(provider: ProviderFormat): string {
  if (provider === "workflow") {
    return "Workflow";
  }

  return provider;
}

function formatModelName(task: GenerationTask): string {
  if (task.provider === "workflow" && task.model === "seethrough") {
    return "SeeThrough分层";
  }

  return task.model;
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}
