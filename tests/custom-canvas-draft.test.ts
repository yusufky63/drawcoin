import assert from "node:assert/strict";
import test from "node:test";

import {
  canvasHasContent,
  createCanvasDraft,
  restoreCanvasDraft,
} from "../src/components/ui/CustomCanvas/utils/draftUtils.ts";
import type {
  CustomCanvasProps,
  DrawingElement,
} from "../src/components/ui/CustomCanvas/types.ts";

function makeLine(): DrawingElement {
  return {
    type: "line",
    color: "#111111",
    lineWidth: 4,
    points: [
      { x: 10, y: 20 },
      { x: 30, y: 40 },
    ],
  };
}

test("canvas drafts are versioned, JSON-safe, and detached from live state", () => {
  const imageData = "data:image/png;base64,drawcoin";
  const source: DrawingElement[] = [
    makeLine(),
    {
      type: "image",
      color: "#000000",
      lineWidth: 1,
      startPoint: { x: 100, y: 120 },
      width: 200,
      height: 160,
      imageData,
    },
  ];

  const draft = createCanvasDraft(source);
  const roundTrip = JSON.parse(JSON.stringify(draft));

  assert.equal(draft.version, 1);
  assert.deepEqual(draft.canvas, {
    width: 1024,
    height: 1024,
    background: "#ffffff",
  });
  assert.equal(roundTrip.elements[1].imageData, imageData);

  source[0].points![0].x = 999;
  assert.equal(draft.elements[0].points![0].x, 10);
});

test("restoring a smaller legacy scene scales it into the 1024 square", () => {
  const restored = restoreCanvasDraft({
    version: 1,
    canvas: { width: 400, height: 400, background: "#ffeeaa" },
    elements: [makeLine(), { type: "unknown" }],
  });

  assert.deepEqual(restored.canvas, {
    width: 1024,
    height: 1024,
    background: "#ffeeaa",
  });
  assert.equal(restored.elements.length, 1);
  assert.deepEqual(restored.elements[0].points, [
    { x: 25.6, y: 51.2 },
    { x: 76.8, y: 102.4 },
  ]);
  assert.equal(restored.elements[0].lineWidth, 10.24);
});

test("content detection rejects empty marks and a white canvas background", () => {
  const whiteBackground: DrawingElement = {
    type: "rectangle",
    color: "#ffffff",
    lineWidth: 0,
    startPoint: { x: 0, y: 0 },
    endPoint: { x: 1024, y: 1024 },
    filled: true,
    fillColor: "white",
  };
  const coloredBackground: DrawingElement = {
    ...whiteBackground,
    fillColor: "#ffcc00",
  };

  assert.equal(canvasHasContent([]), false);
  assert.equal(
    canvasHasContent([
      { ...makeLine(), points: [{ x: 10, y: 10 }] },
      {
        type: "text",
        color: "#000000",
        lineWidth: 1,
        startPoint: { x: 10, y: 10 },
        text: "   ",
      },
      whiteBackground,
    ]),
    false
  );
  assert.equal(canvasHasContent([coloredBackground]), true);
  assert.equal(canvasHasContent([makeLine()]), true);
  assert.equal(canvasHasContent([], 1024, 1024, "#ffcc00"), true);
});

test("content detection follows paint color and alpha over the blank canvas", () => {
  const whiteLine = { ...makeLine(), color: "#ffffff" };
  const transparentLine = { ...makeLine(), opacity: 0 };
  const transparentPaintLine = {
    ...makeLine(),
    color: "rgba(0, 0, 0, 0)",
  };
  const whiteText: DrawingElement = {
    type: "text",
    color: "rgb(255, 255, 255)",
    lineWidth: 1,
    startPoint: { x: 20, y: 40 },
    text: "Invisible on white",
  };
  const whiteShape: DrawingElement = {
    type: "rectangle",
    color: "#fff",
    lineWidth: 4,
    startPoint: { x: 10, y: 10 },
    endPoint: { x: 100, y: 100 },
    filled: true,
    fillColor: "rgba(255, 255, 255, 0.5)",
  };
  const coloredFill: DrawingElement = {
    ...whiteShape,
    lineWidth: 0,
    fillColor: "#ef4444",
  };
  const transparentImage: DrawingElement = {
    type: "image",
    color: "#000000",
    lineWidth: 1,
    startPoint: { x: 0, y: 0 },
    width: 100,
    height: 100,
    imageData: "data:image/png;base64,drawcoin",
    opacity: 0,
  };

  assert.equal(canvasHasContent([whiteLine]), false);
  assert.equal(canvasHasContent([transparentLine]), false);
  assert.equal(canvasHasContent([transparentPaintLine]), false);
  assert.equal(canvasHasContent([whiteText]), false);
  assert.equal(canvasHasContent([whiteShape]), false);
  assert.equal(canvasHasContent([transparentImage]), false);
  assert.equal(canvasHasContent([coloredFill]), true);
  assert.equal(canvasHasContent([whiteLine], 1024, 1024, "#111111"), true);
});

test("draft restore clamps unsafe opacity and stroke widths", () => {
  const restored = restoreCanvasDraft({
    version: 1,
    canvas: { width: 1024, height: 1024, background: "#ffffff" },
    elements: [
      { ...makeLine(), opacity: -2, lineWidth: -8 },
      { ...makeLine(), opacity: 9 },
    ],
  });

  assert.equal(restored.elements[0].opacity, 0);
  assert.equal(restored.elements[0].lineWidth, 0);
  assert.equal(restored.elements[1].opacity, 1);
});

test("canvas interaction can be explicitly disabled by the parent", () => {
  const props: CustomCanvasProps = { interactionEnabled: false };
  assert.equal(props.interactionEnabled, false);
});

test("an unsupported or malformed draft restores as a safe empty scene", () => {
  assert.deepEqual(restoreCanvasDraft({ version: 2, elements: [makeLine()] }), {
    canvas: { width: 1024, height: 1024, background: "#ffffff" },
    elements: [],
  });
});
