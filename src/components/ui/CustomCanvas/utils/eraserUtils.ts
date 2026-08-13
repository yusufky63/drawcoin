import type { DrawingElement, Point } from "../types.ts";

export const ERASER_SIZE_MULTIPLIER = 6;
export const ERASER_COLOR = "#FFFFFF";

export function getEraserStrokeWidth(lineWidth: number): number {
  return Math.max(1, lineWidth * ERASER_SIZE_MULTIPLIER);
}

export function createEraserElement(
  point: Point,
  lineWidth: number
): DrawingElement {
  return {
    type: "eraser",
    color: ERASER_COLOR,
    lineWidth: Math.max(1, lineWidth),
    opacity: 1,
    points: [point],
  };
}

export function appendEraserPoint(
  element: DrawingElement,
  point: Point
): DrawingElement {
  if (element.type !== "eraser") return element;
  return { ...element, points: [...(element.points ?? []), point] };
}

export function isPointInEraserStroke(
  point: Point,
  element: DrawingElement
): boolean {
  if (element.type !== "eraser" || !element.points?.length) return false;
  const radius = Math.max(0.5, element.lineWidth / 2);
  const points = element.points;

  if (points.length === 1) {
    return Math.hypot(point.x - points[0].x, point.y - points[0].y) <= radius;
  }

  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1];
    const end = points[index];
    const deltaX = end.x - start.x;
    const deltaY = end.y - start.y;
    const lengthSquared = deltaX * deltaX + deltaY * deltaY;
    const progress =
      lengthSquared === 0
        ? 0
        : Math.max(
            0,
            Math.min(
              1,
              ((point.x - start.x) * deltaX + (point.y - start.y) * deltaY) /
                lengthSquared
            )
          );
    const closestX = start.x + progress * deltaX;
    const closestY = start.y + progress * deltaY;
    if (Math.hypot(point.x - closestX, point.y - closestY) <= radius) {
      return true;
    }
  }

  return false;
}

export function drawEraserStroke(
  ctx: CanvasRenderingContext2D,
  element: DrawingElement
) {
  const points = element.points ?? [];
  if (element.type !== "eraser" || points.length === 0 || element.lineWidth <= 0) {
    return;
  }

  ctx.save();
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "destination-out";
  ctx.strokeStyle = ERASER_COLOR;
  ctx.fillStyle = ERASER_COLOR;
  ctx.lineWidth = element.lineWidth;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (points.length === 1) {
    ctx.beginPath();
    ctx.arc(points[0].x, points[0].y, element.lineWidth / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let index = 1; index < points.length; index += 1) {
    ctx.lineTo(points[index].x, points[index].y);
  }
  ctx.stroke();
  ctx.restore();
}

export function resolveCanvasBackground(
  elements: readonly DrawingElement[],
  fallback: string,
  width: number,
  height: number
): string {
  const backgroundElement = elements.find((element) => {
    if (
      element.type !== "rectangle" ||
      !element.filled ||
      !element.startPoint ||
      !element.endPoint ||
      element.lineWidth !== 0
    ) {
      return false;
    }

    return (
      Math.abs(element.startPoint.x) < 1 &&
      Math.abs(element.startPoint.y) < 1 &&
      Math.abs(element.endPoint.x - width) < 1 &&
      Math.abs(element.endPoint.y - height) < 1
    );
  });

  return backgroundElement?.fillColor ?? backgroundElement?.color ?? fallback;
}

export function restoreErasedBackground(
  ctx: CanvasRenderingContext2D,
  background: string,
  width: number,
  height: number
) {
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "destination-over";
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}
