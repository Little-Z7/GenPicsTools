import { describe, expect, it } from "vitest";
import viteConfig from "../../vite.config";

describe("vite config", () => {
  it("uses relative asset paths for packaged Electron file loading", () => {
    const config = viteConfig as { base?: string };

    expect(config.base).toBe("./");
  });
});
