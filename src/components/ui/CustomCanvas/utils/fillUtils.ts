import { DEFAULT_CANVAS_SIZE } from "../constants.ts";
import type { DrawingElement, Point } from "../types.ts";
import { isPointInsideShape } from "./canvasUtils.ts";

const FILLABLE_SHAPE_TYPES = new Set<DrawingElement["type"]>([
  "rectangle",
  "circle",
  "triangle",
  "star",
]);

function isCanvasBackground(
  element: DrawingElement,
  width: number,
  height: number
) {
  return (
    element.type === "rectangle" &&
    element.lineWidth === 0 &&
    element.startPoint !== undefined &&
    element.endPoint !== undefined &&
    Math.abs(element.startPoint.x) < 1 &&
    Math.abs(element.startPoint.y) < 1 &&
    Math.abs(element.endPoint.x - width) < 1 &&
    Math.abs(element.endPoint.y - height) < 1
  );
}

/**
 * Applies one vector fill action. Non-fillable lines and eraser masks are
 * transparent to hit testing, so they cannot silently consume the click.
 */
export function applyCanvasFill(
  elements: readonly DrawingElement[],
  point: Point,
  color: string,
  width = DEFAULT_CANVAS_SIZE,
  height = DEFAULT_CANVAS_SIZE
): DrawingElement[] {
  for (let index = elements.length - 1; index >= 0; index -= 1) {
    const element = elements[index];
    if (
      FILLABLE_SHAPE_TYPES.has(element.type) &&
      isPointInsideShape(point, element)
    ) {
      const nextElements = [...elements];
      nextElements[index] = {
        ...element,
        filled: true,
        fillColor: color,
      };
      return nextElements;
    }
  }

  const background: DrawingElement = {
    type: "rectangle",
    startPoint: { x: 0, y: 0 },
    endPoint: { x: width, y: height },
    color,
    lineWidth: 0,
    filled: true,
    fillColor: color,
    opacity: 1,
  };

  return [
    background,
    ...elements.filter((element) => !isCanvasBackground(element, width, height)),
  ];
}
