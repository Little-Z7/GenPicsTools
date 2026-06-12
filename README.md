# AI Image Tool

Windows desktop AI image generation tool built with Electron, React, and TypeScript.

## Features

- Windowed desktop UI.
- OpenAI-compatible image generation provider.
- Gemini native image generation provider.
- Drag-and-drop or file picker reference image inputs.
- SQLite-backed local task queue.
- Configurable concurrent generation workers.
- Editable Base URL, API Key, model, size/aspect ratio, count, concurrency, and output directory.
- Local config, task history, task errors, reference image metadata, and output metadata.
- Generated images saved as local files with preview URLs.
- Windows portable packaging through Electron Builder.

## Provider Setup

OpenAI-compatible:

- Format: `OpenAI Compatible`
- Base URL example: `https://api.openai.com/v1`
- Model example: `gpt-image-1`
- Text-only endpoint: `{base_url}/images/generations`
- Reference-image endpoint: `{base_url}/images/edits`
- Base URL may be either the root `/v1` URL or a full `/images/generations` / `/images/edits` endpoint.
- API Key may be entered as either `sk-...` or `Bearer sk-...`.

Gemini:

- Format: `Gemini`
- Base URL example: `https://generativelanguage.googleapis.com/v1beta`
- Model example: `gemini-2.5-flash-image`
- Endpoint used by the app: `{base_url}/models/{model}:generateContent`
- Reference images are sent as inline image parts.

## Reference Images

Supported formats:

- PNG
- JPG / JPEG
- WebP

Images can be dragged onto the reference area or selected through the file picker. The app copies selected references into its user data directory, so queued tasks do not depend on the original files staying in place.

## Task Queue

Tasks are stored in local SQLite and use these statuses:

- `queued`
- `running`
- `succeeded`
- `failed`
- `cancelled`

The concurrency setting controls how many tasks run at the same time. Failed and cancelled tasks can be retried.

## Development

```bash
npm install
npm run dev
```

## Verification

```bash
npm test -- --run
npm run typecheck
npm run build
```

## Packaging

```bash
npm run dist
```

Build output:

- Directory build: `release/win-unpacked/AI Image Tool.exe`
- Portable executable: `release/AI Image Tool 0.1.0.exe`

The portable executable includes the app runtime. The directory build can also be distributed by copying the whole `release/win-unpacked` folder.

## Local Data

Electron stores config, history, outputs, and logs under the app user data directory. Generated images are saved to the output directory selected in the UI.

The SQLite database is stored under the app user data directory as `app.sqlite`. Reference image copies are stored in the app user data `references` directory.
