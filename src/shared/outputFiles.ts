const previewableImageExtensions = new Set(["png", "jpg", "jpeg", "webp"]);

export function isPreviewableImageOutput(filePath: string): boolean {
  return previewableImageExtensions.has(extensionFromPath(filePath));
}

function extensionFromPath(filePath: string): string {
  const withoutQuery = filePath.split(/[?#]/, 1)[0];
  const match = withoutQuery.match(/\.([a-z0-9]+)$/i);
  return match?.[1]?.toLowerCase() ?? "";
}
