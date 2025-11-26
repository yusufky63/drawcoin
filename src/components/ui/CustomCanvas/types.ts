export interface Point {
  x: number;
  y: number;
}

export interface DrawingElement {
  type:
    | "line"
    | "rectangle"
    | "circle"
    | "text"
    | "image"
    | "triangle"
    | "arrow"
    | "star";
  color: string;
  lineWidth: number;
  points?: Point[];
  startPoint?: Point;
  endPoint?: Point;
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  imageData?: string;
  opacity?: number;
  width?: number;
  height?: number;
  filled?: boolean;
  fillColor?: string;
  scaleX?: number;
  scaleY?: number;
}

export type Tool =
  | "pen"
  | "eraser"
  | "rectangle"
  | "circle"
  | "line"
  | "text"
  | "select"
  | "fill"
  | "triangle"
  | "arrow"
  | "star";

export type PenStyle = "pen" | "brush" | "marker" | "highlighter";

export type ResizeHandle = "tl" | "tr" | "bl" | "br" | null;

export interface CustomCanvasRef {
  exportImage: () => Promise<string | null>;
  clearCanvas: () => void;
}

export interface CustomCanvasProps {
  width?: number;
  height?: number;
}

