# SQLite Reference Image Queue Design

## Goal

Extend AI Image Tool from a single-shot generator into a local task workbench with SQLite persistence, reference image inputs, and concurrent generation workers for OpenAI-compatible and Gemini providers.

## Data Model

The app uses a local SQLite database in Electron's user data directory. The database stores durable workflow state while large binary assets remain on disk.

Tables:

- `settings`: key/value settings for provider config, output directory, and concurrency.
- `tasks`: generation task metadata, status, provider, model, prompt, size, count, error, retry count, timestamps.
- `task_reference_images`: copied reference image paths, original name, MIME type, byte size, and task order.
- `task_outputs`: generated image paths, preview file URLs, revised prompts, and timestamps.

Reference images and output images are stored under the app data directory or selected output directory. SQLite stores file paths and metadata only.

## Task States

Tasks move through these states:

- `queued`: accepted and waiting for a worker.
- `running`: being processed by a worker.
- `succeeded`: all provider outputs were saved.
- `failed`: provider request, parsing, file, or validation failure.
- `cancelled`: cancelled before a worker started, or best-effort aborted while running.

The UI can enqueue, retry failed tasks, cancel queued/running tasks, and inspect task errors.

## Reference Image Flow

The renderer accepts images through drag/drop and file picker. The main process validates file extension and MIME type, copies the file into an app-managed `references` directory, and returns metadata for UI preview. Enqueued tasks store a snapshot of those reference image records, so task execution is independent of the original user-selected file location.

Supported formats: PNG, JPEG, and WebP.

## Provider Adapters

OpenAI-compatible:

- Without reference images: use `POST /images/generations`.
- With reference images: use `POST /images/edits` with `multipart/form-data`.
- Normalize API keys whether the user enters `sk-...` or `Bearer sk-...`.
- Accept either a root Base URL such as `/v1` or a full endpoint such as `/v1/images/generations` or `/v1/images/edits`.

Gemini:

- Use `models/{model}:generateContent`.
- Send prompt as a text part.
- Send reference images as inline image parts with MIME type and base64 data.
- Use `generationConfig.responseModalities` and `generationConfig.responseFormat.image.aspectRatio` where applicable.

If a provider does not support reference images, the task fails with a direct message and remains retryable.

## Concurrency

The main process owns a task queue service. It reads queued tasks from SQLite and runs up to `concurrency` workers at once. The default is 2. Each worker updates the task row before and after execution, saves output images, and emits task updates to the renderer.

The service uses AbortController for best-effort cancellation. Queued tasks can be cancelled synchronously. Running tasks are marked as cancelling and the HTTP request is aborted when the adapter supports it.

## UI

The UI becomes a task workbench:

- Left settings sidebar: provider, Base URL, API Key, model, size/aspect ratio, output directory, concurrency.
- Prompt and references panel: prompt editor, drag/drop zone, selected reference image thumbnails, file picker button.
- Task queue panel: status filters, queued/running/succeeded/failed cards, retry and cancel buttons.
- Preview panel: selected task references, outputs, paths, and error details.

## Migration

Existing JSON config remains readable for compatibility. On first run after the SQLite upgrade, the app imports existing config into SQLite settings. Existing JSON history can be ignored or migrated opportunistically into `tasks` if present.

## Verification

Tests cover:

- SQLite schema initialization and task CRUD.
- Reference image validation and copy behavior.
- OpenAI generation vs edit endpoint selection and multipart payload construction.
- Gemini inlineData request construction.
- Task runner concurrency, failure, retry, and cancellation state transitions.
- Vite relative asset path for packaged Electron.
