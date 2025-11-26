import { DrawingElement, Point } from "../types";

export const getTextDimensions = (
  ctx: CanvasRenderingContext2D,
  text: string,
  fontSize: number,
  fontFamily: string = "Arial"
) => {
  ctx.font = `${fontSize}px ${fontFamily}`;
  const lines = text.split("\n");
  const lineHeight = fontSize * 1.2;

  let maxWidth = 0;
  lines.forEach((line) => {
    const metrics = ctx.measureText(line);
    maxWidth = Math.max(maxWidth, metrics.width);
  });

  return {
    width: maxWidth,
    height: lines.length * lineHeight,
    lines: lines,
  };
};

export const getMousePosition = (
  e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>,
  canvas: HTMLCanvasElement
): Point => {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;

  if ("touches" in e) {
    return {
      x: (e.touches[0].clientX - rect.left) * scaleX,
      y: (e.touches[0].clientY - rect.top) * scaleY,
    };
  } else {
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }
};

export const calculateElementBounds = (
  element: DrawingElement,
  ctx: CanvasRenderingContext2D
) => {
  if (!element.startPoint) {
    if (element.points && element.points.length > 0) {
      let minX = element.points[0].x;
      let maxX = element.points[0].x;
      let minY = element.points[0].y;
      let maxY = element.points[0].y;

      element.points.forEach((p) => {
        minX = Math.min(minX, p.x);
        maxX = Math.max(maxX, p.x);
        minY = Math.min(minY, p.y);
        maxY = Math.max(maxY, p.y);
      });

      return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
    }
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  let x = element.startPoint.x;
  let y = element.startPoint.y;
  let width = 0;
  let height = 0;

  if (element.type === "image") {
    width = element.width || 200;
    height = element.height || 200;
  } else if (element.type === "text" && element.text) {
    const dims = getTextDimensions(
      ctx,
      element.text,
      element.fontSize || 24,
      element.fontFamily
    );
    const scaleX = element.scaleX || 1;
    const scaleY = element.scaleY || 1;
    
    width = dims.width * scaleX;
    height = dims.height * scaleY;
    // Text baseline adjustment - text starts above the startPoint
    y = element.startPoint.y - (element.fontSize || 24) * 0.8 * scaleY;
  } else if (element.endPoint) {
    if (element.type === "circle") {
      const radius = Math.sqrt(
        Math.pow(element.endPoint.x - element.startPoint.x, 2) +
          Math.pow(element.endPoint.y - element.startPoint.y, 2)
      );
      x = element.startPoint.x - radius;
      y = element.startPoint.y - radius;
      width = radius * 2;
      height = radius * 2;
    } else {
      const minX = Math.min(element.startPoint.x, element.endPoint.x);
      const maxX = Math.max(element.startPoint.x, element.endPoint.x);
      const minY = Math.min(element.startPoint.y, element.endPoint.y);
      const maxY = Math.max(element.startPoint.y, element.endPoint.y);
      x = minX;
      y = minY;
      width = maxX - minX;
      height = maxY - minY;
    }
  }

  return { x, y, width, height };
};

export const isPointInElement = (
  point: Point,
  element: DrawingElement,
  ctx: CanvasRenderingContext2D
): boolean => {
  if (element.type === "image" && element.startPoint) {
    const w = element.width || 200;
    const h = element.height || 200;
    const padding = 5;
    return (
      point.x >= element.startPoint.x - padding &&
      point.x <= element.startPoint.x + w + padding &&
      point.y >= element.startPoint.y - padding &&
      point.y <= element.startPoint.y + h + padding
    );
  }

  if (element.type === "text" && element.text && element.startPoint) {
    const dims = getTextDimensions(
      ctx,
      element.text,
      element.fontSize || 24,
      element.fontFamily
    );
    const scaleX = element.scaleX || 1;
    const scaleY = element.scaleY || 1;
    const padding = 5;
    
    // Text baseline adjustment
    const textY = element.startPoint.y - (element.fontSize || 24) * 0.8 * scaleY;
    return (
      point.x >= element.startPoint.x - padding &&
      point.x <= element.startPoint.x + dims.width * scaleX + padding &&
      point.y >= textY - padding &&
      point.y <= textY + dims.height * scaleY + padding
    );
  }

  if (element.startPoint && element.endPoint) {
    if (element.type === "circle") {
      const radius = Math.sqrt(
        Math.pow(element.endPoint.x - element.startPoint.x, 2) +
          Math.pow(element.endPoint.y - element.startPoint.y, 2)
      );
      const padding = 5;
      return (
        point.x >= element.startPoint.x - radius - padding &&
        point.x <= element.startPoint.x + radius + padding &&
        point.y >= element.startPoint.y - radius - padding &&
        point.y <= element.startPoint.y + radius + padding
      );
    } else {
      const minX = Math.min(element.startPoint.x, element.endPoint.x);
      const maxX = Math.max(element.startPoint.x, element.endPoint.x);
      const minY = Math.min(element.startPoint.y, element.endPoint.y);
      const maxY = Math.max(element.startPoint.y, element.endPoint.y);
      const padding = 8;

      return (
        point.x >= minX - padding &&
        point.x <= maxX + padding &&
        point.y >= minY - padding &&
        point.y <= maxY + padding
      );
    }
  }

  if (element.points && element.points.length > 0) {
    const threshold = Math.max(8, (element.lineWidth || 3) + 5);

    for (let j = 0; j < element.points.length - 1; j++) {
      const p1 = element.points[j];
      const p2 = element.points[j + 1];

      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const length = Math.sqrt(dx * dx + dy * dy);

      if (length === 0) {
        const dist = Math.sqrt(
          Math.pow(point.x - p1.x, 2) + Math.pow(point.y - p1.y, 2)
        );
        if (dist <= threshold) {
          return true;
        }
      } else {
        const t = Math.max(
          0,
          Math.min(
            1,
            ((point.x - p1.x) * dx + (point.y - p1.y) * dy) / (length * length)
          )
        );
        const projX = p1.x + t * dx;
        const projY = p1.y + t * dy;
        const dist = Math.sqrt(
          Math.pow(point.x - projX, 2) + Math.pow(point.y - projY, 2)
        );

        if (dist <= threshold) {
          return true;
        }
      }
    }
  }

  return false;
};

export const isPointInsideShape = (
  point: Point,
  element: DrawingElement,
): boolean => {
  if (!element.startPoint || !element.endPoint) return false;

  if (element.type === "rectangle") {
    const minX = Math.min(element.startPoint.x, element.endPoint.x);
    const maxX = Math.max(element.startPoint.x, element.endPoint.x);
    const minY = Math.min(element.startPoint.y, element.endPoint.y);
    const maxY = Math.max(element.startPoint.y, element.endPoint.y);

    // Add small tolerance for easier clicking
    const tolerance = 2;
    return (
      point.x >= minX + tolerance &&
      point.x <= maxX - tolerance &&
      point.y >= minY + tolerance &&
      point.y <= maxY - tolerance
    );
  }

  if (element.type === "circle") {
    const radius = Math.sqrt(
      Math.pow(element.endPoint.x - element.startPoint.x, 2) +
        Math.pow(element.endPoint.y - element.startPoint.y, 2)
    );
    const distance = Math.sqrt(
      Math.pow(point.x - element.startPoint.x, 2) +
        Math.pow(point.y - element.startPoint.y, 2)
    );
    // Add small tolerance
    return distance <= radius - 2;
  }

  if (element.type === "triangle") {
    // Point in triangle test using barycentric coordinates
    const width = element.endPoint.x - element.startPoint.x;
    
    // Triangle vertices
    const x1 = element.startPoint.x + width / 2;  // Top center
    const y1 = element.startPoint.y;
    const x2 = element.endPoint.x;               // Bottom right
    const y2 = element.endPoint.y;
    const x3 = element.startPoint.x;             // Bottom left
    const y3 = element.endPoint.y;

    // Calculate barycentric coordinates
    const denominator = ((y2 - y3) * (x1 - x3) + (x3 - x2) * (y1 - y3));
    if (Math.abs(denominator) < 0.001) return false; // Degenerate triangle
    
    const a = ((y2 - y3) * (point.x - x3) + (x3 - x2) * (point.y - y3)) / denominator;
    const b = ((y3 - y1) * (point.x - x3) + (x1 - x3) * (point.y - y3)) / denominator;
    const c = 1 - a - b;

    // Point is inside if all coordinates are positive (with small tolerance)
    const tolerance = -0.01;
    return a >= tolerance && b >= tolerance && c >= tolerance;
  }

  if (element.type === "star") {
    // Approximation: check if point is within inner radius (more accurate for fill)
    const outerRadius = Math.sqrt(
      Math.pow(element.endPoint.x - element.startPoint.x, 2) +
        Math.pow(element.endPoint.y - element.startPoint.y, 2)
    );
    const innerRadius = outerRadius / 2; // Star's inner radius
    const distance = Math.sqrt(
      Math.pow(point.x - element.startPoint.x, 2) +
        Math.pow(point.y - element.startPoint.y, 2)
    );
    // Point must be within inner radius for more accurate fill detection
    return distance <= innerRadius;
  }

  return false;
};

