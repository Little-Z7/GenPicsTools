# Resolution And Annotation Design

**Goal:** Expand image size choices and add a lightweight in-app annotation flow for generated previews.

**Confirmed Scope**
- Add more preset sizes for OpenAI-compatible providers.
- Add more preset aspect ratios for Gemini providers.
- Keep a custom size field so users can enter provider-specific values not listed in the presets.
- Add quick preview tools: brush, arrow, rectangle, text, cover block, undo, clear, and save annotated copy.
- Save annotated images as new output files and add them to the same task history.

**Architecture**
- Move provider size presets into a shared helper so renderer code does not own provider rules.
- Add a main-process annotation module that accepts a PNG data URL, writes a new image next to the source output, and records it through the task store.
- Keep annotation drawing in the renderer with a canvas. The renderer exports the edited canvas as PNG and delegates file/database writes to IPC.

**Data Flow**
- Renderer selects an output image and opens a modal canvas editor.
- Canvas loads the original image from its `fileUrl`.
- Save sends `taskId`, source file path, and `data:image/png;base64,...` to `outputs:saveAnnotation`.
- Main process writes `<original-name>-annotated-YYYYMMDD-HHMMSS.png`, adds a `task_outputs` row, broadcasts `tasks:changed`, and returns the saved image record.

**Testing**
- Unit-test provider size preset selection and custom-size detection.
- Unit-test annotation saving with a temp directory and injected timestamp.
- Run full unit tests, typecheck, build, and package after implementation.
