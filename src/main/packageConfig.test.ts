import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

interface PackageJson {
  build?: {
    win?: {
      icon?: string;
    };
  };
}

describe("package config", () => {
  it("configures a Windows application icon for packaged releases", () => {
    const packageJson = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")) as PackageJson;
    const iconPath = packageJson.build?.win?.icon;

    expect(iconPath).toBe("assets/icon.ico");
    expect(existsSync(join(process.cwd(), iconPath ?? ""))).toBe(true);
  });
});
