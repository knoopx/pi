/**
 * Column type definitions for the table renderer.
 */

export interface Column {
  /** Column header label */
  key: string;
  /** Right-align values (for numbers) */
  align?: "left" | "right";
  /** Minimum column width */
  minWidth?: number;
  /** Maximum column width before wrapping */
  maxWidth?: number;
  /** Format cell value (return ANSI-colored string) */
  format?: (value: unknown, row: Record<string, unknown>) => string;
}

export interface MeasuredColumn extends Column {
  width: number;
}
