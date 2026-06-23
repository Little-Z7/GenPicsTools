import { describe, expect, it } from "vitest";
import { isPreviewableImageOutput } from "./outputFiles";

describe("output file helpers", () => {
  it("only treats common raster image outputs as previewable images", () => {
    expect(isPreviewableImageOutput("C:/tmp/result.png")).toBe(true);
    expect(isPreviewableImageOutput("C:/tmp/result.jpg")).toBe(true);
    expect(isPreviewableImageOutput("C:/tmp/result.jpeg")).toBe(true);
    expect(isPreviewableImageOutput("C:/tmp/result.webp")).toBe(true);
    expect(isPreviewableImageOutput("C:/tmp/layers.zip")).toBe(false);
    expect(isPreviewableImageOutput("C:/tmp/movie.mp4")).toBe(false);
  });
});
