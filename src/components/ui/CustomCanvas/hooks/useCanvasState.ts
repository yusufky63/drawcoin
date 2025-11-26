import { useState, useRef } from "react";
import { DrawingElement, Tool, PenStyle, ResizeHandle, Point } from "../types";
import { DEFAULT_LINE_WIDTH, DEFAULT_FONT_SIZE, DEFAULT_FONT_FAMILY } from "../constants";

export const useCanvasState = () => {
  const [isDrawing, setIsDrawing] = useState(false);
  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState("#000000");
  const [lineWidth, setLineWidth] = useState(DEFAULT_LINE_WIDTH);
  const [elements, setElements] = useState<DrawingElement[]>([]);
  const [currentElement, setCurrentElement] = useState<DrawingElement | null>(null);
  const [startPoint, setStartPoint] = useState<Point | null>(null);
  const [textInput, setTextInput] = useState("");
  const [showTextInput, setShowTextInput] = useState(false);
  const [textPosition, setTextPosition] = useState<Point>({ x: 0, y: 0 });
  const [fontSize, setFontSize] = useState(DEFAULT_FONT_SIZE);
  const [fontFamily, setFontFamily] = useState(DEFAULT_FONT_FAMILY);
  const [isMobile, setIsMobile] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [canvasBackground, setCanvasBackground] = useState("#ffffff");
  const [penStyle, setPenStyle] = useState<PenStyle>("pen");
  const [selectedElement, setSelectedElement] = useState<number | null>(null);
  const [selectedElements, setSelectedElements] = useState<number[]>([]);
  const [selectionBox, setSelectionBox] = useState<{ start: Point; end: Point } | null>(null);
  const [hoveredElement, setHoveredElement] = useState<number | null>(null);
  const [dragOffset, setDragOffset] = useState<Point>({ x: 0, y: 0 });
  const [resizeHandle, setResizeHandle] = useState<ResizeHandle>(null);
  const [originalSize, setOriginalSize] = useState<{ width: number; height: number } | null>(null);
  const [customColor, setCustomColor] = useState("#000000");

  const lastClickTime = useRef<number>(0);
  const lastClickElement = useRef<number | null>(null);
  const dragStartPos = useRef<Point | null>(null);
  const isDragging = useRef<boolean>(false);
  const imageCache = useRef<Map<string, HTMLImageElement>>(new Map());

  return {
    // State
    isDrawing,
    tool,
    color,
    lineWidth,
    elements,
    currentElement,
    startPoint,
    textInput,
    showTextInput,
    textPosition,
    fontSize,
    fontFamily,
    isMobile,
    showClearConfirm,
    canvasBackground,
    penStyle,
    selectedElement,
    selectedElements,
    selectionBox,
    hoveredElement,
    dragOffset,
    resizeHandle,
    originalSize,
    customColor,

    // Setters
    setIsDrawing,
    setTool,
    setColor,
    setLineWidth,
    setElements,
    setCurrentElement,
    setStartPoint,
    setTextInput,
    setShowTextInput,
    setTextPosition,
    setFontSize,
    setFontFamily,
    setIsMobile,
    setShowClearConfirm,
    setCanvasBackground,
    setPenStyle,
    setSelectedElement,
    setSelectedElements,
    setSelectionBox,
    setHoveredElement,
    setDragOffset,
    setResizeHandle,
    setOriginalSize,
    setCustomColor,

    // Refs
    lastClickTime,
    lastClickElement,
    dragStartPos,
    isDragging,
    imageCache,
  };
};

