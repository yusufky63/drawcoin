import { DEFAULT_CANVAS_SIZE } from "../constants.ts";
import {
  CUSTOM_CANVAS_DRAFT_VERSION,
  type CustomCanvasDraft,
  type DrawingElement,
  type Point,
} from "../types.ts";
import { ERASER_COLOR } from "./eraserUtils.ts";

const DEFAULT_BACKGROUND = "#ffffff";
const ELEMENT_TYPES = new Set<DrawingElement["type"]>([
  "line",
  "eraser",
  "rectangle",
  "circle",
  "text",
  "image",
  "triangle",
  "arrow",
  "star",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function positiveNumber(value: unknown): number | undefined {
  const parsed = finiteNumber(value);
  return parsed !== undefined && parsed > 0 ? parsed : undefined;
}

function pointFromUnknown(value: unknown): Point | undefined {
  if (!isRecord(value)) return undefined;
  const x = finiteNumber(value.x);
  const y = finiteNumber(value.y);
  return x !== undefined && y !== undefined ? { x, y } : undefined;
}

function stringFromUnknown(value: unknown, fallback: string): string {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

export function cloneDrawingElement(
  value: unknown
): DrawingElement | null {
  if (!isRecord(value) || !ELEMENT_TYPES.has(value.type as DrawingElement["type"])) {
    return null;
  }

  const element: DrawingElement = {
    type: value.type as DrawingElement["type"],
    // Older/local drafts may have persisted the selected drawing color on an
    // eraser element. Erasing is a raster mask, so its serialized color is an
    // invariant too: always restore it as white.
    color:
      value.type === "eraser"
        ? ERASER_COLOR
        : stringFromUnknown(value.color, "#000000"),
    lineWidth: Math.max(0, finiteNumber(value.lineWidth) ?? 1),
  };
  const points = Array.isArray(value.points)
    ? value.points
        .map(pointFromUnknown)
        .filter((point): point is Point => point !== undefined)
    : undefined;
  const startPoint = pointFromUnknown(value.startPoint);
  const endPoint = pointFromUnknown(value.endPoint);
  const parsedOpacity = finiteNumber(value.opacity);
  const opacity =
    parsedOpacity === undefined ? undefined : clamp(parsedOpacity, 0, 1);
  const width = positiveNumber(value.width);
  const height = positiveNumber(value.height);
  const fontSize = positiveNumber(value.fontSize);
  const scaleX = positiveNumber(value.scaleX);
  const scaleY = positiveNumber(value.scaleY);

  if (points && points.length > 0) element.points = points;
  if (startPoint) element.startPoint = startPoint;
  if (endPoint) element.endPoint = endPoint;
  if (typeof value.text === "string") element.text = value.text;
  if (fontSize !== undefined) element.fontSize = fontSize;
  if (typeof value.fontFamily === "string" && value.fontFamily.length > 0) {
    element.fontFamily = value.fontFamily;
  }
  if (typeof value.imageData === "string" && value.imageData.length > 0) {
    element.imageData = value.imageData;
  }
  if (opacity !== undefined) element.opacity = opacity;
  if (width !== undefined) element.width = width;
  if (height !== undefined) element.height = height;
  if (typeof value.filled === "boolean") element.filled = value.filled;
  if (typeof value.fillColor === "string" && value.fillColor.length > 0) {
    element.fillColor = value.fillColor;
  }
  if (scaleX !== undefined) element.scaleX = scaleX;
  if (scaleY !== undefined) element.scaleY = scaleY;

  return element;
}

export function cloneDrawingElements(
  elements: readonly DrawingElement[]
): DrawingElement[] {
  return elements.flatMap((element) => {
    const clone = cloneDrawingElement(element);
    return clone ? [clone] : [];
  });
}

function scaleElement(
  element: DrawingElement,
  scaleX: number,
  scaleY: number
): DrawingElement {
  const clone = cloneDrawingElement(element);
  if (!clone) return element;
  const scalePoint = (point: Point): Point => ({
    x: point.x * scaleX,
    y: point.y * scaleY,
  });

  if (clone.points) clone.points = clone.points.map(scalePoint);
  if (clone.startPoint) clone.startPoint = scalePoint(clone.startPoint);
  if (clone.endPoint) clone.endPoint = scalePoint(clone.endPoint);
  if (clone.width !== undefined) clone.width *= scaleX;
  if (clone.height !== undefined) clone.height *= scaleY;
  clone.lineWidth *= (scaleX + scaleY) / 2;
  if (clone.fontSize !== undefined) clone.fontSize *= scaleY;
  return clone;
}

export function restoreCanvasDraft(
  value: unknown,
  targetWidth = DEFAULT_CANVAS_SIZE,
  targetHeight = DEFAULT_CANVAS_SIZE
): Pick<CustomCanvasDraft, "canvas" | "elements"> {
  if (!isRecord(value) || value.version !== CUSTOM_CANVAS_DRAFT_VERSION) {
    return {
      canvas: {
        width: targetWidth,
        height: targetHeight,
        background: DEFAULT_BACKGROUND,
      },
      elements: [],
    };
  }

  const sourceCanvas = isRecord(value.canvas) ? value.canvas : {};
  const sourceWidth = positiveNumber(sourceCanvas.width) ?? targetWidth;
  const sourceHeight = positiveNumber(sourceCanvas.height) ?? targetHeight;
  const background = stringFromUnknown(
    sourceCanvas.background,
    DEFAULT_BACKGROUND
  );
  const sourceElements = Array.isArray(value.elements)
    ? value.elements.flatMap((element) => {
        const clone = cloneDrawingElement(element);
        return clone ? [clone] : [];
      })
    : [];
  const scaleX = targetWidth / sourceWidth;
  const scaleY = targetHeight / sourceHeight;

  return {
    canvas: { width: targetWidth, height: targetHeight, background },
    elements:
      scaleX === 1 && scaleY === 1
        ? sourceElements
        : sourceElements.map((element) => scaleElement(element, scaleX, scaleY)),
  };
}

export function createCanvasDraft(
  elements: readonly DrawingElement[],
  background = DEFAULT_BACKGROUND,
  width = DEFAULT_CANVAS_SIZE,
  height = DEFAULT_CANVAS_SIZE
): CustomCanvasDraft {
  return {
    version: CUSTOM_CANVAS_DRAFT_VERSION,
    canvas: {
      width,
      height,
      background: stringFromUnknown(background, DEFAULT_BACKGROUND),
    },
    elements: cloneDrawingElements(elements),
  };
}

function hasVisibleDistance(first: Point, second: Point): boolean {
  return Math.hypot(second.x - first.x, second.y - first.y) > 0.5;
}

interface RgbaColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

const OPAQUE_WHITE: RgbaColor = { r: 255, g: 255, b: 255, a: 1 };

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function parseRgbChannel(value: string): number | null {
  const trimmed = value.trim();
  const parsed = Number.parseFloat(trimmed);
  if (!Number.isFinite(parsed)) return null;
  return trimmed.endsWith("%")
    ? clamp((parsed / 100) * 255, 0, 255)
    : clamp(parsed, 0, 255);
}

function parseAlpha(value: string): number | null {
  const trimmed = value.trim();
  const parsed = Number.parseFloat(trimmed);
  if (!Number.isFinite(parsed)) return null;
  return trimmed.endsWith("%")
    ? clamp(parsed / 100, 0, 1)
    : clamp(parsed, 0, 1);
}

function parseHexColor(value: string): RgbaColor | null {
  const hex = value.slice(1);
  if (!/^[0-9a-f]+$/i.test(hex) || ![3, 4, 6, 8].includes(hex.length)) {
    return null;
  }

  const expanded =
    hex.length <= 4
      ? hex
          .split("")
          .map((character) => `${character}${character}`)
          .join("")
      : hex;
  return {
    r: Number.parseInt(expanded.slice(0, 2), 16),
    g: Number.parseInt(expanded.slice(2, 4), 16),
    b: Number.parseInt(expanded.slice(4, 6), 16),
    a:
      expanded.length === 8
        ? Number.parseInt(expanded.slice(6, 8), 16) / 255
        : 1,
  };
}

function parseCssColor(value: string | undefined): RgbaColor | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "white") return OPAQUE_WHITE;
  if (normalized === "black") return { r: 0, g: 0, b: 0, a: 1 };
  if (normalized === "transparent") return { r: 0, g: 0, b: 0, a: 0 };
  if (normalized.startsWith("#")) return parseHexColor(normalized);

  const rgbMatch = normalized.match(/^rgba?\((.*)\)$/);
  if (!rgbMatch) return null;
  const parts = rgbMatch[1].split(",");
  if (parts.length !== 3 && parts.length !== 4) return null;
  const r = parseRgbChannel(parts[0]);
  const g = parseRgbChannel(parts[1]);
  const b = parseRgbChannel(parts[2]);
  const a = parts.length === 4 ? parseAlpha(parts[3]) : 1;
  if (r === null || g === null || b === null || a === null) return null;
  return { r, g, b, a };
}

function colorsDiffer(first: RgbaColor, second: RgbaColor): boolean {
  return (
    Math.abs(first.r - second.r) > 0.5 ||
    Math.abs(first.g - second.g) > 0.5 ||
    Math.abs(first.b - second.b) > 0.5 ||
    Math.abs(first.a - second.a) > 1 / 510
  );
}

function compositeOver(
  foreground: RgbaColor,
  background: RgbaColor,
  opacity: number
): RgbaColor {
  const foregroundAlpha = foreground.a * clamp(opacity, 0, 1);
  const outputAlpha = foregroundAlpha + background.a * (1 - foregroundAlpha);
  if (outputAlpha <= 0) return { r: 0, g: 0, b: 0, a: 0 };

  return {
    r:
      (foreground.r * foregroundAlpha +
        background.r * background.a * (1 - foregroundAlpha)) /
      outputAlpha,
    g:
      (foreground.g * foregroundAlpha +
        background.g * background.a * (1 - foregroundAlpha)) /
      outputAlpha,
    b:
      (foreground.b * foregroundAlpha +
        background.b * background.a * (1 - foregroundAlpha)) /
      outputAlpha,
    a: outputAlpha,
  };
}

function paintChangesBackground(
  paint: string | undefined,
  opacity: number,
  background: string
): boolean {
  if (!paint || opacity <= 0) return false;
  const foregroundColor = parseCssColor(paint);
  if (foregroundColor?.a === 0) return false;
  const backgroundColor = parseCssColor(background);
  if (!foregroundColor || !backgroundColor) return true;
  return colorsDiffer(
    compositeOver(foregroundColor, backgroundColor, opacity),
    backgroundColor
  );
}

function backgroundDiffersFromBlank(background: string): boolean {
  const backgroundColor = parseCssColor(background);
  return backgroundColor
    ? colorsDiffer(backgroundColor, OPAQUE_WHITE)
    : background.trim().toLowerCase() !== DEFAULT_BACKGROUND;
}

export function drawingElementHasContent(
  element: DrawingElement,
  width = DEFAULT_CANVAS_SIZE,
  height = DEFAULT_CANVAS_SIZE,
  background = DEFAULT_BACKGROUND
): boolean {
  void width;
  void height;
  const opacity = clamp(element.opacity ?? 1, 0, 1);
  if (opacity <= 0) return false;
  if (element.type === "eraser") return false;

  if (element.type === "line") {
    const points = element.points ?? [];
    const hasGeometry = points.some(
      (point, index) =>
        index > 0 && hasVisibleDistance(points[index - 1], point)
    );
    return (
      hasGeometry &&
      element.lineWidth > 0 &&
      paintChangesBackground(element.color, opacity, background)
    );
  }
  if (element.type === "text") {
    return Boolean(
      element.startPoint &&
        element.text?.trim() &&
        paintChangesBackground(element.color, opacity, background)
    );
  }
  if (element.type === "image") {
    return Boolean(
      element.startPoint &&
        element.imageData &&
        (element.width ?? 200) > 0 &&
        (element.height ?? 200) > 0
    );
  }
  if (!element.startPoint || !element.endPoint) return false;
  if (!hasVisibleDistance(element.startPoint, element.endPoint)) return false;

  const hasVisibleStroke =
    element.lineWidth > 0 &&
    paintChangesBackground(element.color, opacity, background);
  const hasVisibleFill =
    element.filled === true &&
    paintChangesBackground(element.fillColor, opacity, background);
  return hasVisibleStroke || hasVisibleFill;
}

export function canvasHasContent(
  elements: readonly DrawingElement[],
  width = DEFAULT_CANVAS_SIZE,
  height = DEFAULT_CANVAS_SIZE,
  background = DEFAULT_BACKGROUND
): boolean {
  if (backgroundDiffersFromBlank(background)) return true;
  return elements.some((element) =>
    drawingElementHasContent(element, width, height, background)
  );
}
