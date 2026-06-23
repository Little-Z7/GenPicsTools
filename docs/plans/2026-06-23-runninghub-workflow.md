# SeeThrough RunningHub Workflow Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a fixed RunningHub workflow app named `SeeThrough分层`.

**Architecture:** `Workflow` is a third provider type behind the existing queue, and `seethrough` is the first built-in workflow app. It hides the RunningHub base URL and App ID in the UI, uploads exactly one local reference image, submits a fixed RunningHub AI App request, polls for completion, and normalizes URL outputs into the existing output saver.

**Tech Stack:** Electron, React, TypeScript, Vitest, Fetch/FormData APIs.

---

### Task 1: Provider Types And Routing

**Files:**
- Modify: `src/shared/types.ts`
- Modify: `src/shared/sizeOptions.ts`
- Modify: `src/shared/sizeOptions.test.ts`
- Modify: `src/shared/regenerateTask.test.ts`
- Modify: `src/main/providers/index.ts`

**Step 1: Write failing tests**

Add tests proving `workflow` has no size presets and regeneration preserves the workflow app setting.

**Step 2: Run tests to verify failure**

Run: `npm test -- --run src/shared/sizeOptions.test.ts src/shared/regenerateTask.test.ts`

Expected: FAIL before `ProviderFormat` supports `workflow`.

**Step 3: Implement minimal shared type support**

Add `workflow` to `ProviderFormat` and route `model = "seethrough"` in provider index.

### Task 2: RunningHub Adapter

**Files:**
- Create: `src/main/providers/runninghub.ts`
- Modify: `src/main/providers/index.ts`
- Modify: `src/main/providers/provider.test.ts`

**Step 1: Write failing tests**

Test upload, fixed submit body, query polling, and URL output normalization.

**Step 2: Run test to verify failure**

Run: `npm test -- --run src/main/providers/provider.test.ts`

Expected: FAIL before adapter exists.

**Step 3: Implement adapter**

Add media upload, submit, query polling, fixed App ID, fixed nodeInfoList, and error handling.

### Task 3: Renderer UI

**Files:**
- Modify: `src/renderer/App.tsx`
- Modify: `src/renderer/styles.css`
- Modify: `src/main/main.ts`

**Step 1: Add provider option**

Add `Workflow` to the provider selector and `SeeThrough分层` as the built-in workflow app.

**Step 2: Hide irrelevant controls**

In SeeThrough mode, hide Base URL, model, size, and count controls. Prompt becomes optional note. Require one reference image.

**Step 3: Enqueue fixed task**

Use fixed internal base URL and App ID, provider `seethrough`, and a default prompt note when prompt is empty.

### Task 4: Verification

**Files:**
- Existing tests and package output.

**Step 1: Run full tests**

Run: `npm test -- --run`

Expected: PASS.

**Step 2: Run build**

Run: `npm run build`

Expected: PASS.

**Step 3: Run packaging**

Run: `npm run dist`

Expected: PASS and `release/AI Image Tool 0.1.0.exe` is updated.
