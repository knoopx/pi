export interface ScreenshotScreenParams {
  writeToDisk?: boolean;
  showPointer?: boolean;
  path?: string;
}

export function buildScreenshotScreenArgs(
  params: ScreenshotScreenParams,
): string[] {
  const args = ["action", "screenshot-screen"];
  if (params.writeToDisk !== undefined) {
    args.push("--write-to-disk", String(params.writeToDisk));
  }
  if (params.showPointer !== undefined) {
    args.push("--show-pointer", String(params.showPointer));
  }
  if (params.path) {
    args.push("--path", params.path);
  }
  return args;
}

export interface ScreenshotWindowParams {
  id?: number;
  writeToDisk?: boolean;
  path?: string;
}

export function buildScreenshotWindowArgs(
  params: ScreenshotWindowParams,
): string[] {
  const args = ["action", "screenshot-window"];
  if (params.id !== undefined) {
    args.push("--id", String(params.id));
  }
  if (params.writeToDisk !== undefined) {
    args.push("--write-to-disk", String(params.writeToDisk));
  }
  if (params.path) {
    args.push("--path", params.path);
  }
  return args;
}
