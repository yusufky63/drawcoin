import { DrawingElement } from "../types";
import { drawEraserStroke } from "./eraserUtils";

const getElementOpacity = (element: DrawingElement) =>
  Math.min(1, Math.max(0, element.opacity ?? 1));

export const drawLine = (
  ctx: CanvasRenderingContext2D,
  element: DrawingElement
) => {
  if (!element.points || element.lineWidth <= 0) return;

  ctx.globalAlpha = getElementOpacity(element);
  ctx.strokeStyle = element.color;
  ctx.lineWidth = element.lineWidth;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  ctx.beginPath();
  element.points.forEach((point, index) => {
    if (index === 0) {
      ctx.moveTo(point.x, point.y);
    } else {
      ctx.lineTo(point.x, point.y);
    }
  });
  ctx.stroke();
};

export const drawRectangle = (
  ctx: CanvasRenderingContext2D,
  element: DrawingElement
) => {
  if (!element.startPoint || !element.endPoint) return;

  const width = element.endPoint.x - element.startPoint.x;
  const height = element.endPoint.y - element.startPoint.y;

  ctx.globalAlpha = getElementOpacity(element);
  ctx.strokeStyle = element.color;
  ctx.lineWidth = element.lineWidth;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (element.filled && element.fillColor) {
    ctx.fillStyle = element.fillColor;
    ctx.fillRect(element.startPoint.x, element.startPoint.y, width, height);
  }
  if (element.lineWidth > 0) {
    ctx.strokeRect(element.startPoint.x, element.startPoint.y, width, height);
  }
};

export const drawCircle = (
  ctx: CanvasRenderingContext2D,
  element: DrawingElement
) => {
  if (!element.startPoint || !element.endPoint) return;

  const radius = Math.sqrt(
    Math.pow(element.endPoint.x - element.startPoint.x, 2) +
      Math.pow(element.endPoint.y - element.startPoint.y, 2)
  );

  ctx.globalAlpha = getElementOpacity(element);
  ctx.strokeStyle = element.color;
  ctx.lineWidth = element.lineWidth;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  ctx.beginPath();
  ctx.arc(
    element.startPoint.x,
    element.startPoint.y,
    radius,
    0,
    2 * Math.PI
  );
  if (element.filled && element.fillColor) {
    ctx.fillStyle = element.fillColor;
    ctx.fill();
  }
  if (element.lineWidth > 0) ctx.stroke();
};

export const drawTriangle = (
  ctx: CanvasRenderingContext2D,
  element: DrawingElement
) => {
  if (!element.startPoint || !element.endPoint) return;

  const width = element.endPoint.x - element.startPoint.x;
  const height = element.endPoint.y - element.startPoint.y;

  ctx.globalAlpha = getElementOpacity(element);
  ctx.strokeStyle = element.color;
  ctx.lineWidth = element.lineWidth;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  ctx.beginPath();
  ctx.moveTo(element.startPoint.x + width / 2, element.startPoint.y);
  ctx.lineTo(element.startPoint.x + width, element.startPoint.y + height);
  ctx.lineTo(element.startPoint.x, element.startPoint.y + height);
  ctx.closePath();

  if (element.filled && element.fillColor) {
    ctx.fillStyle = element.fillColor;
    ctx.fill();
  }
  if (element.lineWidth > 0) ctx.stroke();
};

export const drawArrow = (
  ctx: CanvasRenderingContext2D,
  element: DrawingElement
) => {
  if (!element.startPoint || !element.endPoint || element.lineWidth <= 0) return;

  const angle = Math.atan2(
    element.endPoint.y - element.startPoint.y,
    element.endPoint.x - element.startPoint.x
  );
  const headLength = 15;

  ctx.globalAlpha = getElementOpacity(element);
  ctx.strokeStyle = element.color;
  ctx.lineWidth = element.lineWidth;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  ctx.beginPath();
  ctx.moveTo(element.startPoint.x, element.startPoint.y);
  ctx.lineTo(element.endPoint.x, element.endPoint.y);
  ctx.lineTo(
    element.endPoint.x - headLength * Math.cos(angle - Math.PI / 6),
    element.endPoint.y - headLength * Math.sin(angle - Math.PI / 6)
  );
  ctx.moveTo(element.endPoint.x, element.endPoint.y);
  ctx.lineTo(
    element.endPoint.x - headLength * Math.cos(angle + Math.PI / 6),
    element.endPoint.y - headLength * Math.sin(angle + Math.PI / 6)
  );
  ctx.stroke();
};

export const drawStar = (
  ctx: CanvasRenderingContext2D,
  element: DrawingElement
) => {
  if (!element.startPoint || !element.endPoint) return;

  const radius = Math.sqrt(
    Math.pow(element.endPoint.x - element.startPoint.x, 2) +
      Math.pow(element.endPoint.y - element.startPoint.y, 2)
  );
  const spikes = 5;
  const outerRadius = radius;
  const innerRadius = radius / 2;

  ctx.globalAlpha = getElementOpacity(element);
  ctx.strokeStyle = element.color;
  ctx.lineWidth = element.lineWidth;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  ctx.beginPath();
  for (let i = 0; i < spikes * 2; i++) {
    const angle = (i * Math.PI) / spikes - Math.PI / 2;
    const r = i % 2 === 0 ? outerRadius : innerRadius;
    const x = element.startPoint.x + r * Math.cos(angle);
    const y = element.startPoint.y + r * Math.sin(angle);
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.closePath();

  if (element.filled && element.fillColor) {
    ctx.fillStyle = element.fillColor;
    ctx.fill();
  }
  if (element.lineWidth > 0) ctx.stroke();
};

export const drawText = (
  ctx: CanvasRenderingContext2D,
  element: DrawingElement
) => {
  if (!element.startPoint || !element.text) return;

  const font = element.fontFamily || "Arial";
  const fontSize = element.fontSize || 24;
  const scaleX = element.scaleX || 1;
  const scaleY = element.scaleY || 1;

  ctx.save();
  
  // Apply scale transform
  ctx.translate(element.startPoint.x, element.startPoint.y);
  ctx.scale(scaleX, scaleY);
  ctx.translate(-element.startPoint.x, -element.startPoint.y);

  ctx.font = `${fontSize}px ${font}`;
  ctx.fillStyle = element.color;
  ctx.globalAlpha = getElementOpacity(element);

  const lines = element.text.split("\n");
  const lineHeight = fontSize * 1.2;

  lines.forEach((line, index) => {
    ctx.fillText(
      line,
      element.startPoint!.x,
      element.startPoint!.y + index * lineHeight
    );
  });

  ctx.restore();
};

export const drawImage = (
  ctx: CanvasRenderingContext2D,
  element: DrawingElement,
  imageCache: Map<string, HTMLImageElement>,
  onImageReady?: () => void
) => {
  if (!element.imageData || !element.startPoint) return;

  ctx.globalAlpha = getElementOpacity(element);

  let img = imageCache.get(element.imageData);

  if (!img) {
    img = new Image();
    imageCache.set(element.imageData, img);
    img.addEventListener("load", () => onImageReady?.(), { once: true });
    img.src = element.imageData;
  } else if (img.complete && img.naturalWidth > 0) {
    ctx.save();
    ctx.globalAlpha = getElementOpacity(element);
    ctx.drawImage(
      img,
      element.startPoint.x,
      element.startPoint.y,
      element.width || 200,
      element.height || 200
    );
    ctx.restore();
  }
};

export const drawElement = (
  ctx: CanvasRenderingContext2D,
  element: DrawingElement,
  imageCache: Map<string, HTMLImageElement>,
  onImageReady?: () => void
) => {
  switch (element.type) {
    case "eraser":
      drawEraserStroke(ctx, element);
      break;
    case "line":
      drawLine(ctx, element);
      break;
    case "rectangle":
      drawRectangle(ctx, element);
      break;
    case "circle":
      drawCircle(ctx, element);
      break;
    case "triangle":
      drawTriangle(ctx, element);
      break;
    case "arrow":
      drawArrow(ctx, element);
      break;
    case "star":
      drawStar(ctx, element);
      break;
    case "text":
      drawText(ctx, element);
      break;
    case "image":
      drawImage(ctx, element, imageCache, onImageReady);
      break;
  }
  ctx.globalAlpha = 1;
};
