import { describe, expect, it } from "vitest";
import { getSizeOptions, isPresetSize } from "./sizeOptions";

describe("size options", () => {
  it("lists expanded OpenAI-compatible pixel sizes", () => {
    expect(getSizeOptions("openai")).toEqual([
      "512x512",
      "768x768",
      "1024x1024",
      "1024x1536",
      "1536x1024",
      "1280x720",
      "1920x1080",
      "1080x1920",
      "2048x2048"
    ]);
  });

  it("lists expanded Gemini aspect ratios", () => {
    expect(getSizeOptions("gemini")).toEqual(["1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3", "4:5", "5:4", "21:9"]);
  });

  it("does not expose size presets for workflow providers", () => {
    expect(getSizeOptions("workflow")).toEqual([]);
    expect(isPresetSize("workflow", "1024x1024")).toBe(false);
  });

  it("identifies custom values outside provider presets", () => {
    expect(isPresetSize("openai", "1024x1024")).toBe(true);
    expect(isPresetSize("openai", "640x960")).toBe(false);
    expect(isPresetSize("gemini", "16:9")).toBe(true);
    expect(isPresetSize("gemini", "7:5")).toBe(false);
  });
});
