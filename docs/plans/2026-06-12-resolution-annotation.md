# Resolution And Annotation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add expanded size presets, custom size entry, and a lightweight generated-image annotation editor.

**Architecture:** Size presets live in a shared module used by the renderer. Annotation persistence lives in the Electron main process and writes PNG files while recording them in SQLite through the existing task store. The renderer handles canvas drawing only and sends final image data through IPC.

**Tech Stack:** Electron, React, TypeScript, Vitest, SQLite via `node:sqlite`, Canvas API.

---

### Task 1: Shared Size Options

**Files:**
- Create: `src/shared/sizeOptions.test.ts`
- Create: `src/shared/sizeOptions.ts`
- Modify: `src/renderer/App.tsx`

**Step 1: Write the failing test**

Test that OpenAI-compatible sizes include common square, landscape, portrait, and high-resolution options, Gemini ratios include additional aspect ratios, and arbitrary custom values are not treated as presets.

**Step 2: Run test to verify it fails**

Run: `npm test -- --run src/shared/sizeOptions.test.ts`

Expected: FAIL because `src/shared/sizeOptions.ts` does not exist.

**Step 3: Write minimal implementation**

Export `getSizeOptions(provider)` and `isPresetSize(provider, size)`.

**Step 4: Run test to verify it passes**

Run: `npm test -- --run src/shared/sizeOptions.test.ts`

Expected: PASS.

### Task 2: Annotation Save Module

**Files:**
- Create: `src/main/annotations.test.ts`
- Create: `src/main/annotations.ts`
- Modify: `src/main/main.ts`
- Modify: `src/preload/preload.ts`

**Step 1: Write the failing test**

Test that a PNG data URL is decoded into a new annotated file next to the source image and recorded by a task-store-like object.

**Step 2: Run test to verify it fails**

Run: `npm test -- --run src/main/annotations.test.ts`

Expected: FAIL because `src/main/annotations.ts` does not exist.

**Step 3: Write minimal implementation**

Implement `saveAnnotatedImage(taskId, sourcePath, dataUrl, store, options)`.

**Step 4: Run test to verify it passes**

Run: `npm test -- --run src/main/annotations.test.ts`

Expected: PASS.

### Task 3: Renderer Controls

**Files:**
- Modify: `src/renderer/App.tsx`
- Modify: `src/renderer/styles.css`
- Modify: `src/renderer/vite-env.d.ts` if the preload API type needs an explicit global update.

**Step 1: Wire custom size UI**

Replace hard-coded renderer arrays with the shared helper. Add a preset select plus editable custom input.

**Step 2: Add annotation editor**

Add a modal canvas editor for generated output images. Implement brush, arrow, rectangle, text, cover, undo, clear, and save.

**Step 3: Refresh task list after save**

After save, reload tasks and close or keep the editor with updated status.

### Task 4: Verification

**Files:**
- Existing source and tests.

**Step 1: Run full tests**

Run: `npm test -- --run`

Expected: PASS.

**Step 2: Run typecheck**

Run: `npm run typecheck`

Expected: PASS.

**Step 3: Run build**

Run: `npm run build`

Expected: PASS.

**Step 4: Run packaging**

Run: `npm run dist`

Expected: PASS and `release/AI Image Tool 0.1.0.exe` exists.
