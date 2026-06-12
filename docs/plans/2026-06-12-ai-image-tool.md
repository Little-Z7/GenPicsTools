# AI Image Tool Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a distributable Windows desktop AI image generation app with a polished window UI and configurable OpenAI-compatible and Gemini providers.

**Architecture:** Use Electron for desktop packaging, React for the renderer UI, and TypeScript across main, preload, renderer, and shared types. Keep provider-specific API details in main-process adapters and expose only typed IPC methods to the renderer.

**Tech Stack:** Electron, React, TypeScript, Vite, Vitest, Electron Builder, native `fetch`, Node filesystem APIs.

---

### Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `vite.config.ts`
- Create: `index.html`
- Create: `.gitignore`

**Step 1: Create package metadata and scripts**

Add scripts for development, build, tests, packaging, and type checking.

**Step 2: Add TypeScript and Vite configuration**

Configure React compilation for the renderer and TypeScript output for Electron main/preload files.

**Step 3: Install dependencies**

Run: `npm install`
Expected: dependencies are installed and `package-lock.json` is created.

### Task 2: Shared Types and Provider Adapters

**Files:**
- Create: `src/shared/types.ts`
- Create: `src/main/providers/openai.ts`
- Create: `src/main/providers/gemini.ts`
- Create: `src/main/providers/index.ts`
- Create: `src/main/providers/provider.test.ts`

**Step 1: Write adapter tests**

Test that OpenAI and Gemini responses with inline base64 data normalize to generated image payloads. Test OpenAI URL payload handling separately.

**Step 2: Implement shared types**

Define provider format, settings, generation request, normalized image, generation result, config, and history entry types.

**Step 3: Implement OpenAI adapter**

Build request URL from base URL, call `/images/generations`, send auth header, parse `data[].b64_json` or `data[].url`, and normalize results.

**Step 4: Implement Gemini adapter**

Build request URL as `/models/{model}:generateContent`, send `x-goog-api-key`, parse candidate parts with `inlineData`, and normalize results.

**Step 5: Run tests**

Run: `npm test -- --run src/main/providers/provider.test.ts`
Expected: adapter tests pass.

### Task 3: Main Process Storage and IPC

**Files:**
- Create: `src/main/storage.ts`
- Create: `src/main/imageFiles.ts`
- Create: `src/main/logging.ts`
- Create: `src/main/main.ts`
- Create: `src/preload/preload.ts`
- Create: `src/main/storage.test.ts`

**Step 1: Write storage tests**

Test default config creation, config save/load, and history append behavior using a temporary directory.

**Step 2: Implement storage**

Read and write JSON files in the Electron user data directory or injected test directory.

**Step 3: Implement image file saving**

Save normalized base64 images or downloaded URL images to the selected output directory with timestamped filenames.

**Step 4: Implement IPC handlers**

Expose methods for loading config, saving config, choosing output directory, generating images, loading history, and opening output directory.

**Step 5: Run tests**

Run: `npm test -- --run src/main/storage.test.ts`
Expected: storage tests pass.

### Task 4: React UI

**Files:**
- Create: `src/renderer/main.tsx`
- Create: `src/renderer/App.tsx`
- Create: `src/renderer/styles.css`
- Create: `src/renderer/vite-env.d.ts`

**Step 1: Build layout shell**

Create a dense desktop tool layout with a settings sidebar, prompt workspace, preview gallery, and history panel.

**Step 2: Connect IPC bridge**

Load config and history at startup, save config changes explicitly, and call generation through preload methods.

**Step 3: Add interaction states**

Handle validation, loading, success, and error states without blocking the UI.

**Step 4: Add preview and history rendering**

Render generated images from local file paths and show prompt, provider, model, and timestamp history metadata.

### Task 5: Build and Packaging

**Files:**
- Modify: `package.json`
- Create: `README.md`

**Step 1: Configure Electron Builder**

Add Windows `dir` and `portable` targets with app metadata and output directory.

**Step 2: Build the app**

Run: `npm run build`
Expected: renderer and Electron TypeScript builds succeed.

**Step 3: Run tests**

Run: `npm test -- --run`
Expected: all tests pass.

**Step 4: Package Windows app**

Run: `npm run dist`
Expected: `release/` contains a runnable Windows executable or portable app folder.

**Step 5: Document usage**

Document provider configuration, defaults, development commands, test commands, and packaging commands.
