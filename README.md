# AI Image Tool

Windows desktop AI image generation tool built with Electron, React, and TypeScript.

## Features

- Windowed desktop UI.
- OpenAI-compatible image generation provider.
- Gemini native image generation provider.
- Editable Base URL, API Key, model, size/aspect ratio, count, and output directory.
- Local config and generation history.
- Generated images saved as local files with preview URLs.
- Windows portable packaging through Electron Builder.

## Provider Setup

OpenAI-compatible:

- Format: `OpenAI Compatible`
- Base URL example: `https://api.openai.com/v1`
- Model example: `gpt-image-1`
- Endpoint used by the app: `{base_url}/images/generations`

Gemini:

- Format: `Gemini`
- Base URL example: `https://generativelanguage.googleapis.com/v1beta`
- Model example: `gemini-2.5-flash-image`
- Endpoint used by the app: `{base_url}/models/{model}:generateContent`

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
