import assert from "node:assert/strict";
import test from "node:test";

import {
  appendEraserPoint,
  createEraserElement,
  drawEraserStroke,
  ERASER_COLOR,
  getEraserStrokeWidth,
  isPointInEraserStroke,
  resolveCanvasBackground,
  restoreErasedBackground,
} from "../src/components/ui/CustomCanvas/utils/eraserUtils.ts";
import {
  cloneDrawingElement,
  drawingElementHasContent,
  restoreCanvasDraft,
} from "../src/components/ui/CustomCanvas/utils/draftUtils.ts";
import type { DrawingElement } from "../src/components/ui/CustomCanvas/types.ts";

function createContextRecorder() {
  let compositeOperation = "source-over";
  const compositeStack: string[] = [];
  const calls: Array<{
    name: string;
    composite: string;
    args: number[];
    fillStyle?: string;
  }> = [];

  const context = {
    globalAlpha: 1,
    strokeStyle: "",
    fillStyle: "",
    lineWidth: 1,
    lineCap: "butt",
    lineJoin: "miter",
    save() {
      compositeStack.push(compositeOperation);
    },
    restore() {
      compositeOperation = compositeStack.pop() ?? "source-over";
    },
    beginPath() {},
    moveTo(x: number, y: number) {
      calls.push({ name: "moveTo", composite: compositeOperation, args: [x, y] });
    },
    lineTo(x: number, y: number) {
      calls.push({ name: "lineTo", composite: compositeOperation, args: [x, y] });
    },
    stroke() {
      calls.push({ name: "stroke", composite: compositeOperation, args: [] });
    },
    arc(x: number, y: number, radius: number) {
      calls.push({ name: "arc", composite: compositeOperation, args: [x, y, radius] });
    },
    fill() {
      calls.push({ name: "fill", composite: compositeOperation, args: [] });
    },
    fillRect(x: number, y: number, width: number, height: number) {
      calls.push({
        name: "fillRect",
        composite: compositeOperation,
        args: [x, y, width, height],
        fillStyle: String(
          (this as unknown as { fillStyle: string }).fillStyle
        ),
      });
    },
    get globalCompositeOperation() {
      return compositeOperation;
    },
    set globalCompositeOperation(value: string) {
      compositeOperation = value;
    },
  } as unknown as CanvasRenderingContext2D;

  return { context, calls, getComposite: () => compositeOperation };
}

test("eraser gesture keeps a continuous path and does not mutate the prior element", () => {
  const originalLine: DrawingElement = {
    type: "line",
    color: "#0052ff",
    lineWidth: 8,
    points: [
      { x: 0, y: 50 },
      { x: 100, y: 50 },
    ],
  };
  const eraser = appendEraserPoint(
    createEraserElement({ x: 20, y: 50 }, getEraserStrokeWidth(3)),
    { x: 80, y: 50 }
  );

  assert.equal(eraser.lineWidth, 18);
  assert.equal(eraser.color, ERASER_COLOR);
  assert.deepEqual(eraser.points, [
    { x: 20, y: 50 },
    { x: 80, y: 50 },
  ]);
  assert.deepEqual(originalLine.points, [
    { x: 0, y: 50 },
    { x: 100, y: 50 },
  ]);

  const { context, calls, getComposite } = createContextRecorder();
  drawEraserStroke(context, eraser);
  assert.equal(calls.find((call) => call.name === "stroke")?.composite, "destination-out");
  assert.deepEqual(calls.find((call) => call.name === "moveTo")?.args, [20, 50]);
  assert.deepEqual(calls.find((call) => call.name === "lineTo")?.args, [80, 50]);
  assert.equal(getComposite(), "source-over");
  assert.equal(isPointInEraserStroke({ x: 50, y: 50 }, eraser), true);
  assert.equal(isPointInEraserStroke({ x: 50, y: 70 }, eraser), false);
});

test("a single eraser click removes a round pixel area", () => {
  const eraser = createEraserElement({ x: 40, y: 60 }, 20);
  const { context, calls } = createContextRecorder();
  drawEraserStroke(context, eraser);

  assert.deepEqual(calls.find((call) => call.name === "arc")?.args, [40, 60, 10]);
  assert.equal(calls.find((call) => call.name === "fill")?.composite, "destination-out");
});

test("eraser draft data round-trips, scales, and is not artwork by itself", () => {
  const eraser = createEraserElement({ x: 10, y: 20 }, 12);
  const cloned = cloneDrawingElement(eraser);
  assert.deepEqual(cloned, eraser);
  assert.notEqual(cloned, eraser);
  assert.equal(drawingElementHasContent(eraser), false);

  const restored = restoreCanvasDraft(
    {
      version: 1,
      canvas: { width: 512, height: 512, background: "#ffffff" },
      elements: [eraser],
    },
    1024,
    1024
  );
  assert.equal(restored.elements[0].type, "eraser");
  assert.deepEqual(restored.elements[0].points, [{ x: 20, y: 40 }]);
  assert.equal(restored.elements[0].lineWidth, 24);
});

test("legacy eraser drafts cannot restore a selected drawing color", () => {
  const restored = restoreCanvasDraft({
    version: 1,
    canvas: { width: 1024, height: 1024, background: "#ffffff" },
    elements: [
      {
        type: "eraser",
        color: "#ef4444",
        lineWidth: 24,
        points: [{ x: 32, y: 48 }],
      },
    ],
  });

  assert.equal(restored.elements[0].color, ERASER_COLOR);
  assert.deepEqual(restored.elements[0].points, [{ x: 32, y: 48 }]);
});

test("erased pixels are always restored as white", () => {
  const background: DrawingElement = {
    type: "rectangle",
    color: "#facc15",
    lineWidth: 0,
    filled: true,
    fillColor: "#facc15",
    startPoint: { x: 0, y: 0 },
    endPoint: { x: 1024, y: 1024 },
  };
  assert.equal(resolveCanvasBackground([background], "#ffffff", 1024, 1024), "#facc15");

  const { context, calls, getComposite } = createContextRecorder();
  restoreErasedBackground(context, ERASER_COLOR, 1024, 1024);
  const restoredBackground = calls.find((call) => call.name === "fillRect");
  assert.equal(restoredBackground?.composite, "destination-over");
  assert.equal(restoredBackground?.fillStyle, ERASER_COLOR);
  assert.equal(getComposite(), "source-over");
});
