import { appendFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

export async function logError(userDataPath: string, error: unknown): Promise<void> {
  const logsDir = join(userDataPath, "logs");
  await mkdir(logsDir, { recursive: true });
  const message = error instanceof Error ? `${error.message}\n${error.stack ?? ""}` : JSON.stringify(error);
  await appendFile(join(logsDir, "app.log"), `[${new Date().toISOString()}]\n${message}\n\n`, "utf8");
}
