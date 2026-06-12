# AI Image Tool Design

## Goal

Build a distributable Windows desktop app for AI image generation. The app provides a polished windowed UI, stores user-configurable provider settings, supports OpenAI-compatible and Gemini image APIs, saves generated images locally, and can be packaged with its runtime and dependencies.

## Product Shape

The app is an Electron desktop application with a React and TypeScript renderer. It exposes a single-window workflow:

- Configure provider format, base URL, API key, model, image size/aspect ratio, output count, and output directory.
- Enter a prompt and generate images.
- Preview generated images in the app.
- Save configuration and generation history locally.
- Open the output directory from the UI.

## API Compatibility

The request layer uses provider adapters so the UI does not depend on vendor-specific payloads.

OpenAI-compatible adapter:

- Calls an image generation endpoint under the configured base URL.
- Sends model, prompt, size, and count.
- Handles both base64 image payloads and image URLs.
- Normalizes all results into local files.

Gemini adapter:

- Calls `models/{model}:generateContent` under the configured base URL.
- Sends `contents.parts` with the prompt.
- Sends image generation configuration through `generationConfig.responseFormat.image`.
- Extracts inline image parts from the response and normalizes them into local files.

## Local Data

The main process owns filesystem access and persists:

- App configuration in the Electron user data directory.
- Generation history in the Electron user data directory.
- Generated image files in a user-selected output directory.

API keys are stored in the local config file for the first version. A later version can move secrets into Windows Credential Manager.

## Architecture

- Electron main process: app lifecycle, IPC handlers, config/history storage, filesystem operations, shell integration, and HTTP generation calls.
- Preload script: exposes a typed bridge from renderer to main process.
- React renderer: app layout, forms, status, preview gallery, history list, and user interactions.
- Shared TypeScript types: provider settings, generation requests, generation results, and history entries.

## Error Handling

The app validates required fields before generation. The main process converts provider, network, parse, and filesystem failures into user-facing error messages. Raw diagnostic details are written to a log file in the user data directory when available.

## Packaging

The app uses Electron Builder to produce a Windows distributable. The primary target is a one-folder portable app containing `AIImageTool.exe` and required runtime files. An installer target can be added later.

## Verification

Verification covers:

- Unit tests for provider request construction and response parsing.
- Unit tests for config/history storage behavior.
- A local mock path for OpenAI-compatible and Gemini response parsing.
- Manual UI run through the Vite/Electron dev server.
- Windows packaging smoke test by launching the built executable.
