# SQLite Reference Queue Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add local SQLite persistence, reference image upload, and concurrent queued image-generation tasks to AI Image Tool.

**Architecture:** Keep Electron main process responsible for durable state, file access, provider calls, and task scheduling. React renderer becomes a task workbench that talks to main process through typed IPC. Provider adapters accept normalized task input and return normalized generated images.

**Tech Stack:** Electron, React, TypeScript, Vite, Vitest, better-sqlite3, Node filesystem APIs, native fetch/FormData/Blob.

---

### Task 1: SQLite Database Layer

**Files:**
- Create: `src/main/db.ts`
- Create: `src/main/taskStore.ts`
- Create: `src/main/taskStore.test.ts`
- Modify: `src/shared/types.ts`

**Step 1: Write failing task store tests**

Test schema creation, settings get/set, task enqueue, reference image insert, output insert, task status updates, and newest-first listing.

**Step 2: Install SQLite dependency**

Run: `npm install better-sqlite3 && npm install -D @types/better-sqlite3`
Expected: dependency installs and lockfile updates.

**Step 3: Implement database opening and migrations**

Create tables if missing and enable WAL mode.

**Step 4: Implement task store operations**

Implement typed functions for settings, task creation, reference image lookup, output lookup, status updates, retry reset, and cancellation.

**Step 5: Run tests**

Run: `npm test -- --run src/main/taskStore.test.ts`
Expected: PASS.

### Task 2: Reference Image File Handling

**Files:**
- Create: `src/main/referenceImages.ts`
- Create: `src/main/referenceImages.test.ts`
- Modify: `src/shared/types.ts`

**Step 1: Write failing reference image tests**

Test PNG/JPEG/WebP acceptance, unsupported extension rejection, file copy into app references directory, and metadata return.

**Step 2: Implement import helper**

Copy user-selected files into app-managed reference directory with collision-resistant names.

**Step 3: Run tests**

Run: `npm test -- --run src/main/referenceImages.test.ts`
Expected: PASS.

### Task 3: Provider Reference Image Support

**Files:**
- Modify: `src/main/providers/openai.ts`
- Modify: `src/main/providers/gemini.ts`
- Modify: `src/main/providers/provider.test.ts`
- Modify: `src/shared/types.ts`

**Step 1: Write failing provider tests**

Test OpenAI with references chooses `/images/edits`, sends multipart form fields and files, accepts full endpoint Base URLs, and avoids duplicate Bearer prefixes. Test Gemini includes inlineData parts for each reference image.

**Step 2: Extend generation request types**

Add `referenceImages` metadata to generation requests.

**Step 3: Implement OpenAI edit path**

Use `FormData`, `Blob`, and file bytes for reference images. Keep text-only path on `/images/generations`.

**Step 4: Implement Gemini inlineData path**

Read reference image files and attach each as inline data part.

**Step 5: Run tests**

Run: `npm test -- --run src/main/providers/provider.test.ts`
Expected: PASS.

### Task 4: Concurrent Task Runner

**Files:**
- Create: `src/main/taskRunner.ts`
- Create: `src/main/taskRunner.test.ts`
- Modify: `src/main/generationWorkflow.ts`

**Step 1: Write failing runner tests**

Test that concurrency limits active tasks, successful tasks save outputs, failed tasks persist error text, retry resets status, and queued cancel prevents execution.

**Step 2: Implement runner service**

Poll queued tasks, run up to configured concurrency, update SQLite states, emit task change events, and support retry/cancel.

**Step 3: Run tests**

Run: `npm test -- --run src/main/taskRunner.test.ts`
Expected: PASS.

### Task 5: Electron IPC Integration

**Files:**
- Modify: `src/main/main.ts`
- Modify: `src/preload/preload.ts`
- Modify: `src/renderer/vite-env.d.ts`

**Step 1: Replace single-shot IPC with task IPC**

Add handlers for loading settings, saving settings, importing reference images, enqueueing tasks, listing tasks, retrying tasks, cancelling tasks, and task update subscription.

**Step 2: Keep compatibility helpers**

Keep output directory picker and open directory helpers.

**Step 3: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

### Task 6: React Task Workbench UI

**Files:**
- Replace: `src/renderer/App.tsx`
- Modify: `src/renderer/styles.css`

**Step 1: Build settings and prompt panels**

Add provider config, concurrency control, prompt editor, and reference image dropzone/file picker.

**Step 2: Build queue and preview panels**

Render task statuses, outputs, references, error details, retry, and cancel controls.

**Step 3: Connect IPC**

Load settings/tasks on startup, subscribe to updates, enqueue tasks, and refresh after task changes.

**Step 4: Build**

Run: `npm run build`
Expected: PASS.

### Task 7: Packaging and Documentation

**Files:**
- Modify: `README.md`
- Modify: `package.json`

**Step 1: Document SQLite, reference images, and queue behavior**

Update README with supported reference formats, provider behavior, and concurrency settings.

**Step 2: Run full verification**

Run: `npm test -- --run`
Run: `npm run typecheck`
Run: `npm run build`
Expected: all pass.

**Step 3: Package Windows app**

Close running `AI Image Tool` instances, then run: `npm run dist`
Expected: `release/win-unpacked/AI Image Tool.exe` and `release/AI Image Tool 0.1.0.exe` are updated.
