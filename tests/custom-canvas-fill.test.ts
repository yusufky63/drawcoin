import assert from "node:assert/strict";
import test from "node:test";

import { applyCanvasFill } from "../src/components/ui/CustomCanvas/utils/fillUtils.ts";
import { createEraserElement } from "../src/components/ui/CustomCanvas/utils/eraserUtils.ts";
import type { DrawingElement } from "../src/components/ui/CustomCanvas/types.ts";

const rectangle: DrawingElement = {
  type: "rectangle",
  color: "#000000",
  lineWidth: 4,
  startPoint: { x: 100, y: 100 },
  endPoint: { x: 500, y: 500 },
};

test("fill uses the newly selected color on the first action", () => {
  const red = applyCanvasFill([rectangle], { x: 250, y: 250 }, "#EF4444");
  assert.equal(red[0].fillColor, "#EF4444");

  const blue = applyCanvasFill(red, { x: 250, y: 250 }, "#0052FF");
  assert.equal(blue[0].fillColor, "#0052FF");
});

test("lines and eraser masks cannot consume a fill click", () => {
  const line: DrawingElement = {
    type: "line",
    color: "#000000",
    lineWidth: 8,
    points: [
      { x: 0, y: 250 },
      { x: 600, y: 250 },
    ],
  };
  const eraser = createEraserElement({ x: 250, y: 250 }, 30);
  const result = applyCanvasFill(
    [rectangle, line, eraser],
    { x: 250, y: 250 },
    "#10B981"
  );

  assert.equal(result[0].fillColor, "#10B981");
  assert.equal(result[1], line);
  assert.equal(result[2], eraser);
});

test("empty canvas fill replaces the prior background deterministically", () => {
  const red = applyCanvasFill([], { x: 20, y: 20 }, "#EF4444");
  const blue = applyCanvasFill(red, { x: 20, y: 20 }, "#0052FF");

  assert.equal(blue.length, 1);
  assert.equal(blue[0].fillColor, "#0052FF");
  assert.equal(blue[0].lineWidth, 0);
});
