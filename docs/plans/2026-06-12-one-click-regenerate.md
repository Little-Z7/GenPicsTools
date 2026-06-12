# One Click Regenerate Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a quick regenerate button that creates a new queued task from the currently selected task.

**Architecture:** Regeneration reuses the existing queue path by converting a `GenerationTask` back into `CreateTaskInput`. The renderer calls the existing `enqueueTask` preload API, then refreshes tasks and selects the new task. No database schema or provider changes are needed.

**Tech Stack:** React, Electron preload IPC, TypeScript, Vitest.

---

### Task 1: Regenerate Input Helper

**Files:**
- Create: `src/shared/regenerateTask.test.ts`
- Create: `src/shared/regenerateTask.ts`

**Step 1: Write the failing test**

Verify that a finished task is converted to `CreateTaskInput` with provider settings, prompt, size, output directory, count, and reference images preserved, while task status, outputs, IDs, and timestamps are omitted.

**Step 2: Run test to verify it fails**

Run: `npm test -- --run src/shared/regenerateTask.test.ts`

Expected: FAIL because `src/shared/regenerateTask.ts` does not exist.

**Step 3: Write minimal implementation**

Implement `createRegenerateTaskInput(task)`.

**Step 4: Run test to verify it passes**

Run: `npm test -- --run src/shared/regenerateTask.test.ts`

Expected: PASS.

### Task 2: Renderer Button

**Files:**
- Modify: `src/renderer/App.tsx`
- Modify: `src/renderer/styles.css`

**Step 1: Add regenerate action**

In `App`, add `regenerateTask(task)` that calls `enqueueTask(createRegenerateTaskInput(task))`, refreshes the list, selects the new task, and shows status.

**Step 2: Add UI control**

Add a `重新生成` button in the task detail header. Disable it while the selected task is being regenerated.

### Task 3: Verification

**Files:**
- Existing source and tests.

**Step 1: Run full tests**

Run: `npm test -- --run`

Expected: PASS.

**Step 2: Run typecheck and build**

Run: `npm run build`

Expected: PASS.

**Step 3: Package release**

Run: `npm run dist`

Expected: PASS and latest portable exe is updated.
