export interface Column {
  key: string;

  align?: "left" | "right";

  minWidth?: number;

  maxWidth?: number;

  format?: (value: unknown, row: Record<string, unknown>) => string;
}
export interface MeasuredColumn extends Column {
  width: number;
}
