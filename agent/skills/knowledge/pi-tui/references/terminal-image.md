# Terminal Image API Reference

## Types

```typescript
type ImageProtocol = "kitty" | "iterm2" | null;

interface TerminalCapabilities {
  images: ImageProtocol; // Active image protocol, or null if no support
  trueColor: boolean;
  hyperlinks: boolean;
}

interface CellDimensions {
  widthPx: number; // Cell width in pixels
  heightPx: number; // Cell height in pixels
}

interface ImageDimensions {
  widthPx: number; // Image width in pixels
  heightPx: number; // Image height in pixels
}

interface ImageRenderOptions {
  maxWidthCells?: number;
  maxHeightCells?: number;
  preserveAspectRatio?: boolean;
  imageId?: number; // Reuse existing Kitty image ID (for animations/updates)
}
```

## Capability Detection

```typescript
function detectCapabilities(): TerminalCapabilities; // Query terminal capabilities at runtime
function getCapabilities(): TerminalCapabilities; // Get cached capabilities
function resetCapabilitiesCache(): void; // Clear cached capabilities
function setCapabilities(caps: TerminalCapabilities): void; // Override (for tests)
```

## Cell Dimensions

```typescript
function getCellDimensions(): CellDimensions;
function setCellDimensions(dims: CellDimensions): void;
```

Required for image sizing calculations. Set by `ProcessTerminal` after querying the terminal for cell size via CSI c response.

## Image ID Allocation

```typescript
function allocateImageId(): number; // Generate random image ID (avoids collisions between instances)
```

Uses random IDs to avoid collisions between different module instances (e.g., main app vs extensions).

## Encoding Functions

### Kitty Graphics Protocol

```typescript
function encodeKitty(
  base64Data: string,
  options?: { columns?: number; rows?: number; imageId?: number },
): string;
function deleteKittyImage(imageId: number): string; // Uses uppercase 'I' to also free image data
function deleteAllKittyImages(): string; // Uses uppercase 'A' to also free all image data
```

### iTerm2 Inline Images

```typescript
function encodeITerm2(
  base64Data: string,
  options?: {
    width?: number | string;
    height?: number | string;
    name?: string;
    preserveAspectRatio?: boolean;
    inline?: boolean;
  },
): string;
```

## Image Dimension Detection

```typescript
function getPngDimensions(base64Data: string): ImageDimensions | null;
function getJpegDimensions(base64Data: string): ImageDimensions | null;
function getGifDimensions(base64Data: string): ImageDimensions | null;
function getWebpDimensions(base64Data: string): ImageDimensions | null;
function getImageDimensions(
  base64Data: string,
  mimeType: string,
): ImageDimensions | null; // Dispatches to format-specific function
```

Parse image dimensions from base64-encoded headers. Returns `null` if the format is unsupported or the data is invalid.

## Image Rendering

```typescript
function calculateImageRows(
  imageDimensions: ImageDimensions,
  targetWidthCells: number,
  cellDimensions?: CellDimensions,
): number;
```

Calculate how many terminal rows an image will occupy given its pixel dimensions and a target width in cells.

```typescript
function renderImage(
  base64Data: string,
  imageDimensions: ImageDimensions,
  options?: ImageRenderOptions,
): { sequence: string; rows: number; imageId?: number } | null;
```

Generate the full escape sequence for rendering an image. Returns `null` if the terminal does not support images. Includes the protocol-specific encoding (Kitty or iTerm2), calculated dimensions, and optional image ID.

## Hyperlinks

```typescript
function hyperlink(text: string, url: string): string;
```

Wrap text in OSC 8 hyperlink sequence. Renders as clickable hyperlink in supporting terminals (Ghostty, Kitty, WezTerm, iTerm2, VSCode). Non-supporting terminals display plain text with escape sequences ignored.

## Fallback Text

```typescript
function imageFallback(
  mimeType: string,
  dimensions?: ImageDimensions,
  filename?: string,
): string;
```

Generate fallback text when the terminal does not support images. Used by the `Image` component on unsupported terminals.
