import React, {
  useCallback,
  useRef,
  forwardRef,
  useImperativeHandle,
  useEffect,
  useId,
  useState,
} from "react";
import { useCanvasState } from "./hooks/useCanvasState";
import { useCanvasHistory } from "./hooks/useCanvasHistory";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import {
  DesktopInspector,
  DesktopToolbar,
} from "./components/DesktopToolbar";
import { MobileToolbar } from "./components/MobileToolbar";
import { ClearConfirmModal } from "./components/ClearConfirmModal";
import { TextInputOverlay } from "./components/TextInputOverlay";
import type {
  CustomCanvasProps,
  CustomCanvasRef,
  DrawingElement,
  ResizeHandle,
  Tool,
} from "./types";
import { getMousePosition, calculateElementBounds, isPointInElement } from "./utils/canvasUtils";
import { drawElement } from "./utils/drawingUtils";
import {
  appendEraserPoint,
  createEraserElement,
  ERASER_COLOR,
  getEraserStrokeWidth,
  isPointInEraserStroke,
  restoreErasedBackground,
} from "./utils/eraserUtils";
import { applyCanvasFill } from "./utils/fillUtils";
import { DEFAULT_CANVAS_SIZE, DRAG_THRESHOLD } from "./constants";
import {
  canvasHasContent,
  createCanvasDraft,
  restoreCanvasDraft,
} from "./utils/draftUtils";

const CONTENT_CHECK_SIZE = DEFAULT_CANVAS_SIZE;

const CustomCanvas = forwardRef<CustomCanvasRef, CustomCanvasProps>(
  ({ initialDraft, onDraftChange, interactionEnabled = true }, ref) => {
    const canvasDescriptionId = useId();
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [imageRenderRevision, setImageRenderRevision] = useState(0);
    const handleImageReady = useCallback(() => {
      setImageRenderRevision((revision) => revision + 1);
    }, []);
    const activePointerIdRef = useRef<number | null>(null);
    const restoredDraftRef = useRef<ReturnType<typeof restoreCanvasDraft> | null>(
      null
    );
    if (restoredDraftRef.current === null) {
      restoredDraftRef.current = restoreCanvasDraft(initialDraft);
    }
    const state = useCanvasState({
      elements: restoredDraftRef.current.elements,
      background: restoredDraftRef.current.canvas.background,
    });
    const history = useCanvasHistory(restoredDraftRef.current.elements);
    const onDraftChangeRef = useRef(onDraftChange);

    // Destructure state for easier access
    const {
      isDrawing, tool, color, lineWidth, elements, currentElement,
      textInput, showTextInput, textPosition, fontSize, fontFamily,
      showClearConfirm, canvasBackground, penStyle, selectedElement, 
      selectedElements, selectionBox, hoveredElement, dragOffset, 
      resizeHandle, originalSize, customColor, setIsDrawing,
      setTool, setColor, setElements, setCurrentElement, setTextInput, 
      setShowTextInput, setTextPosition, setFontSize, setFontFamily, 
      setShowClearConfirm, setPenStyle, setSelectedElement, setSelectedElements,
      setSelectionBox, setHoveredElement, setDragOffset, setResizeHandle, 
      setOriginalSize, setCustomColor, setLineWidth,
      lastClickTime, lastClickElement, dragStartPos, isDragging, imageCache,
    } = state;
    const activeColorRef = useRef(color);

    const handleColorChange = useCallback(
      (nextColor: string) => {
        activeColorRef.current = nextColor;
        setColor(nextColor);
        setCustomColor(nextColor);
      },
      [setColor, setCustomColor]
    );

    useEffect(() => {
      activeColorRef.current = color;
    }, [color]);

    useEffect(() => {
      onDraftChangeRef.current = onDraftChange;
    }, [onDraftChange]);

    useEffect(() => {
      onDraftChangeRef.current?.(
        createCanvasDraft(
          elements,
          canvasBackground,
          DEFAULT_CANVAS_SIZE,
          DEFAULT_CANVAS_SIZE
        )
      );
    }, [canvasBackground, elements]);

    useEffect(() => {
      if (interactionEnabled) return;
      const canvas = canvasRef.current;
      const activePointerId = activePointerIdRef.current;
      if (
        canvas &&
        activePointerId !== null &&
        canvas.hasPointerCapture(activePointerId)
      ) {
        canvas.releasePointerCapture(activePointerId);
      }
      activePointerIdRef.current = null;
      setIsDrawing(false);
      setCurrentElement(null);
      setShowTextInput(false);
      setSelectionBox(null);
      setResizeHandle(null);
      setOriginalSize(null);
      dragStartPos.current = null;
      isDragging.current = false;
    }, [
      dragStartPos,
      interactionEnabled,
      isDragging,
      setCurrentElement,
      setIsDrawing,
      setOriginalSize,
      setResizeHandle,
      setSelectionBox,
      setShowTextInput,
    ]);

    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;
      if (interactionEnabled) {
        container.removeAttribute("inert");
      } else {
        container.setAttribute("inert", "");
      }
    }, [interactionEnabled]);

    // Keyboard shortcuts
    useKeyboardShortcuts({
      enabled: interactionEnabled,
      showTextInput,
      onUndo: handleUndo,
      onRedo: handleRedo,
      onToolChange: (newTool: Tool) => {
        setTool(newTool);
        if (newTool !== "select") {
          setSelectedElement(null);
          setSelectedElements([]);
          setSelectionBox(null);
        }
      },
      onDeselectElement: () => {
        setSelectedElement(null);
        setSelectedElements([]);
        setSelectionBox(null);
      },
      onCloseTextInput: () => setShowTextInput(false),
    });

    // Canvas rendering effect
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      // Clear canvas
      ctx.fillStyle = canvasBackground;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw all elements
      elements.forEach((element) => {
        drawElement(ctx, element, imageCache.current, handleImageReady);
      });

      // Draw current element being created
      if (currentElement) {
        drawElement(ctx, currentElement, imageCache.current, handleImageReady);
      }

      // Eraser strokes clear pixels from prior artwork. Repaint only behind the
      // scene so erased areas reveal the active canvas background.
      restoreErasedBackground(
        ctx,
        ERASER_COLOR,
        canvas.width,
        canvas.height
      );

      // Draw selection box for single element
      if (tool === "select" && selectedElement !== null && selectedElement < elements.length && selectedElements.length === 0) {
        const element = elements[selectedElement];
        const bounds = calculateElementBounds(element, ctx);
        
        if (bounds.width > 0 || bounds.height > 0) {
          ctx.strokeStyle = "#2563eb";
          ctx.lineWidth = 2;
          ctx.setLineDash([]);
          ctx.strokeRect(bounds.x - 1, bounds.y - 1, bounds.width + 2, bounds.height + 2);

          // Draw resize handles for non-line elements
          if (bounds.width > 0 && bounds.height > 0 && element.type !== "line") {
            const handleSize = 8;
            const handles = [
              { x: bounds.x - handleSize / 2, y: bounds.y - handleSize / 2 },
              { x: bounds.x + bounds.width - handleSize / 2, y: bounds.y - handleSize / 2 },
              { x: bounds.x - handleSize / 2, y: bounds.y + bounds.height - handleSize / 2 },
              { x: bounds.x + bounds.width - handleSize / 2, y: bounds.y + bounds.height - handleSize / 2 },
            ];

            handles.forEach((handle) => {
              ctx.fillStyle = "#FFFFFF";
              ctx.fillRect(handle.x, handle.y, handleSize, handleSize);
              ctx.strokeStyle = "#2563eb";
              ctx.lineWidth = 2;
              ctx.strokeRect(handle.x, handle.y, handleSize, handleSize);
            });
          }
        }
      }

      // Draw selection box for multiple elements
      if (tool === "select" && selectedElements.length > 0) {
        selectedElements.forEach((idx) => {
          if (idx < elements.length) {
            const element = elements[idx];
            const bounds = calculateElementBounds(element, ctx);
            
            if (bounds.width > 0 || bounds.height > 0) {
              ctx.strokeStyle = "#2563eb";
              ctx.lineWidth = 2;
              ctx.setLineDash([]);
              ctx.strokeRect(bounds.x - 1, bounds.y - 1, bounds.width + 2, bounds.height + 2);
            }
          }
        });
      }

      // Draw selection area (drag selection box)
      if (selectionBox) {
        const minX = Math.min(selectionBox.start.x, selectionBox.end.x);
        const minY = Math.min(selectionBox.start.y, selectionBox.end.y);
        const maxX = Math.max(selectionBox.start.x, selectionBox.end.x);
        const maxY = Math.max(selectionBox.start.y, selectionBox.end.y);
        
        // Fill
        ctx.fillStyle = "rgba(59, 130, 246, 0.1)";
        ctx.fillRect(minX, minY, maxX - minX, maxY - minY);
        
        // Border
        ctx.strokeStyle = "#2563eb";
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(minX, minY, maxX - minX, maxY - minY);
        ctx.setLineDash([]);
      }

      // Draw hover feedback (only when select tool is active)
      if (tool === "select" && hoveredElement !== null && hoveredElement !== selectedElement && hoveredElement < elements.length && !isDrawing) {
        const element = elements[hoveredElement];
        const bounds = calculateElementBounds(element, ctx);
        
        if (bounds.width > 0 || bounds.height > 0) {
          ctx.strokeStyle = "#60a5fa";
          ctx.lineWidth = 1.5;
          ctx.setLineDash([4, 4]);
          ctx.strokeRect(bounds.x - 1, bounds.y - 1, bounds.width + 2, bounds.height + 2);
          ctx.setLineDash([]);
        }
      }
    }, [elements, currentElement, selectedElement, selectedElements, selectionBox, hoveredElement, canvasBackground, isDrawing, imageCache, imageRenderRevision, handleImageReady, tool]);

    // Handlers
    function handleUndo() {
      const newElements = history.undo();
      setElements(newElements);
      setSelectedElement(null);
    }

    function handleRedo() {
      const newElements = history.redo();
      if (newElements) {
        setElements(newElements);
        setSelectedElement(null);
      }
    }

    function handleClearConfirmed() {
      setElements([]);
      history.clearHistory();
      setSelectedElement(null);
      setShowClearConfirm(false);
    }

    function handleTextSubmit() {
      if (!textInput.trim()) {
        setShowTextInput(false);
        return;
      }

      const newElement: DrawingElement = {
        type: "text",
        color: activeColorRef.current,
        lineWidth,
        text: textInput,
        fontSize,
        fontFamily,
        startPoint: textPosition,
        scaleX: 1,
        scaleY: 1,
      };

      const newElements = [...elements, newElement];
      setElements(newElements);
      history.addToHistory(newElements);

      setTextInput("");
      setShowTextInput(false);
      setTool("select");
      setSelectedElement(newElements.length - 1);
    }

    async function ensureImagesReadyForExport() {
      const imageSources = Array.from(
        new Set(
          elements.flatMap((element) =>
            element.type === "image" && element.imageData
              ? [element.imageData]
              : []
          )
        )
      );

      await Promise.all(
        imageSources.map(
          (source) =>
            new Promise<void>((resolve) => {
              const cachedImage = imageCache.current.get(source);
              if (cachedImage?.complete) {
                resolve();
                return;
              }

              const image = cachedImage ?? new Image();
              imageCache.current.set(source, image);
              const finish = () => {
                window.clearTimeout(timeoutId);
                image.removeEventListener("load", finish);
                image.removeEventListener("error", finish);
                resolve();
              };
              image.addEventListener("load", finish, { once: true });
              image.addEventListener("error", finish, { once: true });
              const timeoutId = window.setTimeout(finish, 5_000);
              if (!cachedImage) image.src = source;
            })
        )
      );
    }

    async function createExportImage() {
      if (!canvasRef.current) return null;
      await ensureImagesReadyForExport();

      const exportCanvas = document.createElement("canvas");
      exportCanvas.width = DEFAULT_CANVAS_SIZE;
      exportCanvas.height = DEFAULT_CANVAS_SIZE;
      const exportContext = exportCanvas.getContext("2d");
      if (!exportContext) return null;

      exportContext.fillStyle = canvasBackground;
      exportContext.fillRect(
        0,
        0,
        DEFAULT_CANVAS_SIZE,
        DEFAULT_CANVAS_SIZE
      );
      elements.forEach((element) => {
        drawElement(exportContext, element, imageCache.current);
      });
      restoreErasedBackground(
        exportContext,
        ERASER_COLOR,
        DEFAULT_CANVAS_SIZE,
        DEFAULT_CANVAS_SIZE
      );

      return exportCanvas.toDataURL("image/png");
    }

    function hasCompositedContent() {
      const analyticalResult = canvasHasContent(
        elements,
        DEFAULT_CANVAS_SIZE,
        DEFAULT_CANVAS_SIZE,
        canvasBackground
      );
      if (typeof document === "undefined") return analyticalResult;

      const hasUnsettledImage = elements.some((element) => {
        if (element.type !== "image" || !element.imageData) return false;
        const image = imageCache.current.get(element.imageData);
        return !image || !image.complete;
      });
      if (hasUnsettledImage) return analyticalResult;

      try {
        const blankCanvas = document.createElement("canvas");
        const compositedCanvas = document.createElement("canvas");
        blankCanvas.width = CONTENT_CHECK_SIZE;
        blankCanvas.height = CONTENT_CHECK_SIZE;
        compositedCanvas.width = CONTENT_CHECK_SIZE;
        compositedCanvas.height = CONTENT_CHECK_SIZE;
        const blankContext = blankCanvas.getContext("2d", {
          willReadFrequently: true,
        });
        const compositedContext = compositedCanvas.getContext("2d", {
          willReadFrequently: true,
        });
        if (!blankContext || !compositedContext) return analyticalResult;

        blankContext.fillStyle = "#ffffff";
        blankContext.fillRect(0, 0, CONTENT_CHECK_SIZE, CONTENT_CHECK_SIZE);
        compositedContext.fillStyle = canvasBackground;
        compositedContext.fillRect(
          0,
          0,
          CONTENT_CHECK_SIZE,
          CONTENT_CHECK_SIZE
        );
        const sceneScale = CONTENT_CHECK_SIZE / DEFAULT_CANVAS_SIZE;
        compositedContext.save();
        compositedContext.scale(sceneScale, sceneScale);
        elements.forEach((element) => {
          drawElement(compositedContext, element, imageCache.current);
        });
        restoreErasedBackground(
          compositedContext,
          ERASER_COLOR,
          DEFAULT_CANVAS_SIZE,
          DEFAULT_CANVAS_SIZE
        );
        compositedContext.restore();

        const blankPixels = blankContext.getImageData(
          0,
          0,
          CONTENT_CHECK_SIZE,
          CONTENT_CHECK_SIZE
        ).data;
        const compositedPixels = compositedContext.getImageData(
          0,
          0,
          CONTENT_CHECK_SIZE,
          CONTENT_CHECK_SIZE
        ).data;
        for (let index = 0; index < blankPixels.length; index += 1) {
          if (blankPixels[index] !== compositedPixels[index]) return true;
        }
        return false;
      } catch {
        // Cross-origin images can taint a canvas. The color/opacity-aware
        // analytical check is the safe fallback in that case.
        return analyticalResult;
      }
    }

    async function handleDownload() {
      const dataUrl = await createExportImage();
      if (!dataUrl) return;
      const link = document.createElement("a");
      link.download = `drawing-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
    }

    // Expose methods via ref
    useImperativeHandle(ref, () => ({
      exportImage: createExportImage,
      clearCanvas: handleClearConfirmed,
      hasContent: hasCompositedContent,
      getDraft: () =>
        createCanvasDraft(
          elements,
          canvasBackground,
          DEFAULT_CANVAS_SIZE,
          DEFAULT_CANVAS_SIZE
        ),
    }));

    const getPenStyleSettings = () => {
      switch (penStyle) {
        case "pen": return { lineWidth: lineWidth, opacity: 1 };
        case "brush": return { lineWidth: lineWidth * 2, opacity: 0.8 };
        case "marker": return { lineWidth: lineWidth * 1.5, opacity: 0.9 };
        case "highlighter": return { lineWidth: lineWidth * 3, opacity: 0.3 };
        default: return { lineWidth: lineWidth, opacity: 1 };
      }
    };

    function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
      if (!interactionEnabled || !e.isPrimary) return;
      e.preventDefault();
      const canvas = canvasRef.current;
      if (!canvas) return;
      if (!canvas.hasPointerCapture(e.pointerId)) {
        canvas.setPointerCapture(e.pointerId);
      }
      activePointerIdRef.current = e.pointerId;
      const point = getMousePosition(e, canvas);

      if (showTextInput && tool !== "text") {
        if (textInput.trim()) {
          handleTextSubmit();
        } else {
          setShowTextInput(false);
        }
        return;
      }

      if (tool === "select") {
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        // First check if clicking on resize handle of selected element
        if (selectedElement !== null && selectedElement < elements.length && selectedElements.length === 0) {
          const element = elements[selectedElement];
          const bounds = calculateElementBounds(element, ctx);

          // Check resize handles (only for non-line elements)
          if (bounds.width > 0 && bounds.height > 0 && element.type !== "line") {
            const handleSize = 8;
            const hitPadding = 5;

            const handles: Array<{
              name: Exclude<ResizeHandle, null>;
              x: number;
              y: number;
            }> = [
              { name: "tl", x: bounds.x - handleSize / 2, y: bounds.y - handleSize / 2 },
              { name: "tr", x: bounds.x + bounds.width - handleSize / 2, y: bounds.y - handleSize / 2 },
              { name: "bl", x: bounds.x - handleSize / 2, y: bounds.y + bounds.height - handleSize / 2 },
              { name: "br", x: bounds.x + bounds.width - handleSize / 2, y: bounds.y + bounds.height - handleSize / 2 },
            ];

            for (const handle of handles) {
              if (
                point.x >= handle.x - hitPadding &&
                point.x <= handle.x + handleSize + hitPadding &&
                point.y >= handle.y - hitPadding &&
                point.y <= handle.y + handleSize + hitPadding
              ) {
                setResizeHandle(handle.name);
                setOriginalSize({ width: bounds.width, height: bounds.height });
                setIsDrawing(true);
                return;
              }
            }
          }
        }

        // Check if clicking on a multi-selected element
        if (selectedElements.length > 0) {
          for (const idx of selectedElements) {
            if (isPointInElement(point, elements[idx], ctx)) {
              dragStartPos.current = point;
              isDragging.current = false;
              setIsDrawing(true);
              return;
            }
          }
        }

        // Find element at click position
        for (let i = elements.length - 1; i >= 0; i--) {
          if (isPointInEraserStroke(point, elements[i])) break;
          if (isPointInElement(point, elements[i], ctx)) {
            const now = Date.now();
            const isDoubleClick = now - lastClickTime.current < 300 && lastClickElement.current === i;

            lastClickTime.current = now;
            lastClickElement.current = i;

            // Double click on text - edit mode
            if (isDoubleClick && elements[i].type === "text") {
              setTextPosition(elements[i].startPoint!);
              setTextInput(elements[i].text || "");
              setFontSize(elements[i].fontSize || 24);
              setFontFamily(elements[i].fontFamily || "Arial");
              handleColorChange(elements[i].color);
              setShowTextInput(true);

              const newElements = elements.filter((_, index) => index !== i);
              setElements(newElements);
              history.addToHistory(newElements);
              setSelectedElements([]);
              return;
            }

            setSelectedElement(i);
            setSelectedElements([]);
            
            // Set drag offset
            const elem = elements[i];
            if (elem.startPoint) {
              setDragOffset({
                x: point.x - elem.startPoint.x,
                y: point.y - elem.startPoint.y,
              });
            } else if (elem.points && elem.points.length > 0) {
              setDragOffset({
                x: point.x - elem.points[0].x,
                y: point.y - elem.points[0].y,
              });
            }

            dragStartPos.current = point;
            isDragging.current = false;
            setIsDrawing(true);
            return;
          }
        }
        
        // Start selection box drag
        setSelectedElement(null);
        setSelectedElements([]);
        setSelectionBox({ start: point, end: point });
        dragStartPos.current = point;
        isDragging.current = false;
        setIsDrawing(true);
        return;
      }

      if (tool === "text") {
        setTextPosition(point);
        setShowTextInput(true);
        setTextInput("");
        return;
      }

      if (tool === "fill") {
        const newElements = applyCanvasFill(
          elements,
          point,
          activeColorRef.current
        );
        setElements(newElements);
        history.addToHistory(newElements);
        return;
      }

      setIsDrawing(true);

      if (tool === "pen") {
        const settings = getPenStyleSettings();
        setCurrentElement({
          type: "line",
          color: activeColorRef.current,
          lineWidth: settings.lineWidth,
          opacity: settings.opacity,
          points: [point],
        });
      } else if (tool === "eraser") {
        setCurrentElement(
          createEraserElement(point, getEraserStrokeWidth(lineWidth))
        );
      } else {
        setCurrentElement({
          type: tool as DrawingElement["type"],
          color: activeColorRef.current,
          lineWidth,
          opacity: 1,
          startPoint: point,
          endPoint: point,
        });
      }
    }

    function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
      if (!interactionEnabled || !e.isPrimary) return;
      e.preventDefault();
      const canvas = canvasRef.current;
      if (!canvas) return;
      const point = getMousePosition(e, canvas);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      if (tool === "select" && isDrawing) {
        // Handle selection box drag
        if (selectionBox) {
          setSelectionBox({ start: selectionBox.start, end: point });
          return;
        }

        // Handle multi-element drag
        if (selectedElements.length > 0) {
          if (dragStartPos.current && !isDragging.current) {
            const dx = Math.abs(point.x - dragStartPos.current.x);
            const dy = Math.abs(point.y - dragStartPos.current.y);
            if (Math.sqrt(dx * dx + dy * dy) < DRAG_THRESHOLD) return;
            isDragging.current = true;
          }

          if (!isDragging.current) return;

          const deltaX = point.x - dragStartPos.current!.x;
          const deltaY = point.y - dragStartPos.current!.y;

          const newElements = [...elements];
          selectedElements.forEach((idx) => {
            const element = newElements[idx];
            if (element.startPoint) {
              element.startPoint = {
                x: element.startPoint.x + deltaX,
                y: element.startPoint.y + deltaY,
              };
              if (element.endPoint) {
                element.endPoint = {
                  x: element.endPoint.x + deltaX,
                  y: element.endPoint.y + deltaY,
                };
              }
              if (element.points) {
                element.points = element.points.map((p) => ({
                  x: p.x + deltaX,
                  y: p.y + deltaY,
                }));
              }
            } else if (element.points) {
              element.points = element.points.map((p) => ({
                x: p.x + deltaX,
                y: p.y + deltaY,
              }));
            }
          });

          setElements(newElements);
          dragStartPos.current = point;
          return;
        }

        // Handle single element drag/resize
        if (selectedElement !== null) {
          const newElements = [...elements];
          const element = newElements[selectedElement];

        // Handle resize
        if (resizeHandle && originalSize && element.startPoint) {

          if (element.type === "image") {
            const originalAspectRatio = originalSize.width / originalSize.height;

            if (resizeHandle === "br") {
              const newWidth = Math.max(50, point.x - element.startPoint.x);
              const newHeight = newWidth / originalAspectRatio;
              element.width = newWidth;
              element.height = newHeight;
            } else if (resizeHandle === "tr") {
              const newWidth = Math.max(50, point.x - element.startPoint.x);
              const newHeight = newWidth / originalAspectRatio;
              const oldHeight = element.height || originalSize.height;
              element.width = newWidth;
              element.height = newHeight;
              element.startPoint.y = element.startPoint.y + oldHeight - newHeight;
            } else if (resizeHandle === "bl") {
              const newWidth = Math.max(50, element.startPoint.x - point.x);
              const newHeight = newWidth / originalAspectRatio;
              const oldWidth = element.width || originalSize.width;
              element.width = newWidth;
              element.height = newHeight;
              element.startPoint.x = element.startPoint.x + oldWidth - newWidth;
            } else if (resizeHandle === "tl") {
              const newWidth = Math.max(50, element.startPoint.x - point.x);
              const newHeight = newWidth / originalAspectRatio;
              const oldWidth = element.width || originalSize.width;
              const oldHeight = element.height || originalSize.height;
              element.width = newWidth;
              element.height = newHeight;
              element.startPoint.x = element.startPoint.x + oldWidth - newWidth;
              element.startPoint.y = element.startPoint.y + oldHeight - newHeight;
            }
          } else if (element.type === "text") {
            // Scale text area (not font size)
            // originalSize is already scaled, so we work with actual dimensions
            if (resizeHandle === "br") {
              // Bottom-right: scale both dimensions
              const newWidth = Math.max(20, point.x - element.startPoint.x);
              const newHeight = Math.max(20, point.y - element.startPoint.y);
              element.scaleX = newWidth / originalSize.width;
              element.scaleY = newHeight / originalSize.height;
            } else if (resizeHandle === "tr") {
              // Top-right: scale width, adjust Y
              const currentBottom = element.startPoint.y + originalSize.height;
              const newWidth = Math.max(20, point.x - element.startPoint.x);
              const newHeight = Math.max(20, currentBottom - point.y);
              element.scaleX = newWidth / originalSize.width;
              element.scaleY = newHeight / originalSize.height;
              element.startPoint.y = currentBottom - newHeight;
            } else if (resizeHandle === "bl") {
              // Bottom-left: scale height, adjust X
              const currentRight = element.startPoint.x + originalSize.width;
              const newWidth = Math.max(20, currentRight - point.x);
              const newHeight = Math.max(20, point.y - element.startPoint.y);
              element.scaleX = newWidth / originalSize.width;
              element.scaleY = newHeight / originalSize.height;
              element.startPoint.x = currentRight - newWidth;
            } else if (resizeHandle === "tl") {
              // Top-left: scale both, adjust both
              const currentRight = element.startPoint.x + originalSize.width;
              const currentBottom = element.startPoint.y + originalSize.height;
              const newWidth = Math.max(20, currentRight - point.x);
              const newHeight = Math.max(20, currentBottom - point.y);
              element.scaleX = newWidth / originalSize.width;
              element.scaleY = newHeight / originalSize.height;
              element.startPoint.x = currentRight - newWidth;
              element.startPoint.y = currentBottom - newHeight;
            }
          } else if (element.endPoint) {
            // Resize shapes
            if (resizeHandle === "br") {
              element.endPoint = { x: point.x, y: point.y };
            } else if (resizeHandle === "tr") {
              element.endPoint = { x: point.x, y: element.endPoint.y };
              const oldStartY = element.startPoint.y;
              element.startPoint.y = point.y;
              element.endPoint.y = oldStartY;
            } else if (resizeHandle === "bl") {
              element.endPoint = { x: element.endPoint.x, y: point.y };
              const oldStartX = element.startPoint.x;
              element.startPoint.x = point.x;
              element.endPoint.x = oldStartX;
            } else if (resizeHandle === "tl") {
              element.startPoint = { x: point.x, y: point.y };
            }
          }
          setElements(newElements);
          return;
        }

        // Check drag threshold
        if (dragStartPos.current && !isDragging.current) {
          const dx = Math.abs(point.x - dragStartPos.current.x);
          const dy = Math.abs(point.y - dragStartPos.current.y);
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < DRAG_THRESHOLD) return;
          isDragging.current = true;
        }

        if (!isDragging.current) return;

        // Drag element
        const newX = point.x - dragOffset.x;
        const newY = point.y - dragOffset.y;

        if (element.startPoint) {
          const deltaX = newX - element.startPoint.x;
          const deltaY = newY - element.startPoint.y;

          element.startPoint = { x: newX, y: newY };

          if (element.endPoint) {
            element.endPoint = {
              x: element.endPoint.x + deltaX,
              y: element.endPoint.y + deltaY,
            };
          }

          if (element.points) {
            element.points = element.points.map((p) => ({
              x: p.x + deltaX,
              y: p.y + deltaY,
            }));
          }
        } else if (element.points && element.points.length > 0) {
          // For pen lines without startPoint
          const deltaX = newX - element.points[0].x;
          const deltaY = newY - element.points[0].y;

          element.points = element.points.map((p) => ({
            x: p.x + deltaX,
            y: p.y + deltaY,
          }));
        }

          setElements(newElements);
          return;
        }
      }

      // Hover detection (only for select tool)
      if (!isDrawing && tool === "select") {
        for (let i = elements.length - 1; i >= 0; i--) {
          if (isPointInEraserStroke(point, elements[i])) break;
          if (isPointInElement(point, elements[i], ctx)) {
            setHoveredElement(i);
            return;
          }
        }
        setHoveredElement(null);
      } else {
        // Clear hover when not using select tool
        setHoveredElement(null);
      }

      // Eraser is stored as a compositing stroke so only touched pixels are
      // cleared; the original line, shape, text, or image remains intact.
      if (tool === "eraser" && isDrawing) {
        setCurrentElement((element) =>
          element ? appendEraserPoint(element, point) : element
        );
        return;
      }

      if (!isDrawing) return;

      if (tool === "pen") {
        setCurrentElement((element) =>
          element
            ? { ...element, points: [...(element.points ?? []), point] }
            : element
        );
      } else {
        if (!currentElement) return;
        setCurrentElement({
          ...currentElement,
          endPoint: point,
        });
      }
    }

    function handlePointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
      if (!e.isPrimary) return;
      const canvas = canvasRef.current;
      if (canvas?.hasPointerCapture(e.pointerId)) {
        canvas.releasePointerCapture(e.pointerId);
      }
      activePointerIdRef.current = null;
      if (!interactionEnabled) {
        setIsDrawing(false);
        setCurrentElement(null);
        return;
      }
      if (!isDrawing) return;
      setIsDrawing(false);

      if (tool === "select") {
        // Complete selection box
        if (selectionBox) {
          const minX = Math.min(selectionBox.start.x, selectionBox.end.x);
          const minY = Math.min(selectionBox.start.y, selectionBox.end.y);
          const maxX = Math.max(selectionBox.start.x, selectionBox.end.x);
          const maxY = Math.max(selectionBox.start.y, selectionBox.end.y);

          const canvas = canvasRef.current;
          const ctx = canvas?.getContext("2d");
          if (!ctx) return;

          // Find all elements within selection box
          const selected: number[] = [];
          elements.forEach((element, idx) => {
            if (element.type === "eraser") return;
            const bounds = calculateElementBounds(element, ctx);
            
            // Check if element is within selection box
            if (
              bounds.x >= minX &&
              bounds.y >= minY &&
              bounds.x + bounds.width <= maxX &&
              bounds.y + bounds.height <= maxY
            ) {
              selected.push(idx);
            }
          });

          setSelectedElements(selected);
          setSelectionBox(null);
          return;
        }

        // Handle single or multi-element drag
        if (selectedElement !== null || selectedElements.length > 0) {
          if (isDragging.current || resizeHandle !== null) {
            history.addToHistory([...elements]);
          }
          setResizeHandle(null);
          setOriginalSize(null);
          dragStartPos.current = null;
          isDragging.current = false;
          return;
        }
      }

      // Commit one eraser gesture as one undo/redo operation.
      if (tool === "eraser") {
        if (!currentElement) return;
        const newElements = [...elements, currentElement];
        setElements(newElements);
        history.addToHistory(newElements);
        setCurrentElement(null);
        return;
      }

      if (!currentElement) return;

      const newElements = [...elements, currentElement];
      setElements(newElements);
      history.addToHistory(newElements);
      setCurrentElement(null);
    }

    function handlePointerCancel(e: React.PointerEvent<HTMLCanvasElement>) {
      if (!e.isPrimary) return;
      const canvas = canvasRef.current;
      if (canvas?.hasPointerCapture(e.pointerId)) {
        canvas.releasePointerCapture(e.pointerId);
      }
      activePointerIdRef.current = null;

      if (tool === "select" && (isDragging.current || resizeHandle !== null)) {
        history.addToHistory(elements);
      }

      setIsDrawing(false);
      setCurrentElement(null);
      setSelectionBox(null);
      setResizeHandle(null);
      setOriginalSize(null);
      dragStartPos.current = null;
      isDragging.current = false;
    }

    return (
      <div
        ref={containerRef}
        className={`mx-auto w-full max-w-[75rem] ${
          interactionEnabled ? "" : "pointer-events-none"
        }`}
        role="group"
        aria-label="Drawing workspace"
        aria-disabled={!interactionEnabled}
      >
        <div className="relative z-0 flex flex-col lg:flex-row lg:items-start lg:justify-center lg:gap-3">
          <div className="mx-auto min-w-0 w-full max-w-[40rem] lg:mx-0 lg:w-[min(calc(100dvh-12rem),calc(100vw-20rem),48rem)] lg:max-w-none">
            <DesktopToolbar
              tool={tool}
              historyStep={history.historyStep}
              historyLength={history.history.length}
              onToolChange={setTool}
              onUndo={handleUndo}
              onRedo={handleRedo}
              onClear={() => setShowClearConfirm(true)}
              onDownload={handleDownload}
            />
            <div
              className="relative mt-2 aspect-square w-full overflow-hidden rounded-lg border-2 border-[#2d3748] bg-white shadow-[3px_3px_0_#171717] focus-within:ring-2 focus-within:ring-[#0052ff] focus-within:ring-offset-2 sm:rounded-xl lg:mt-3"
            >
              <div 
                className="relative flex aspect-square w-full items-center justify-center bg-gray-50"
              >
                <p id={canvasDescriptionId} className="sr-only">
                  Interactive drawing canvas. Use the nearby toolbar to choose a
                  tool, color, and stroke size, then draw with a pointer or touch.
                </p>
                <canvas
                  ref={canvasRef}
                  width={DEFAULT_CANVAS_SIZE}
                  height={DEFAULT_CANVAS_SIZE}
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerCancel={handlePointerCancel}
                  role="img"
                  aria-label="DrawCoin interactive drawing canvas"
                  aria-describedby={canvasDescriptionId}
                  tabIndex={interactionEnabled ? 0 : -1}
                  className="bg-white touch-none"
                  style={{
                    cursor: !interactionEnabled
                      ? "default"
                      : tool === "pen"
                        ? "crosshair"
                        : tool === "eraser"
                          ? "cell"
                          : tool === "select"
                            ? "pointer"
                            : tool === "fill"
                              ? "crosshair"
                              : "default",
                    width: "100%",
                    height: "100%",
                    display: "block",
                    touchAction: "none",
                  }}
                />

                <TextInputOverlay
                  show={showTextInput}
                  position={textPosition}
                  value={textInput}
                  fontSize={fontSize}
                  fontFamily={fontFamily}
                  color={color}
                  onChange={setTextInput}
                  onSubmit={handleTextSubmit}
                  onCancel={() => {
                    setShowTextInput(false);
                    setTextInput("");
                  }}
                  onFontSizeChange={setFontSize}
                  onFontFamilyChange={setFontFamily}
                />
              </div>
            </div>

            {/* Mobile Toolbar - Canvas'ın hemen altında */}
            <MobileToolbar
              tool={tool}
              color={color}
              lineWidth={lineWidth}
              penStyle={penStyle}
              onToolChange={setTool}
              onColorChange={handleColorChange}
              onLineWidthChange={setLineWidth}
              onPenStyleChange={setPenStyle}
              onUndo={handleUndo}
              onRedo={handleRedo}
              onClear={() => setShowClearConfirm(true)}
              onDownload={handleDownload}
              historyStep={history.historyStep}
              historyLength={history.history.length}
            />
          </div>

          <DesktopInspector
            tool={tool}
            color={color}
            customColor={customColor}
            lineWidth={lineWidth}
            penStyle={penStyle}
            onToolChange={setTool}
            onColorChange={handleColorChange}
            onCustomColorChange={setCustomColor}
            onLineWidthChange={setLineWidth}
            onPenStyleChange={setPenStyle}
          />
        </div>

        <ClearConfirmModal
          show={showClearConfirm}
          onConfirm={handleClearConfirmed}
          onCancel={() => setShowClearConfirm(false)}
        />
      </div>
    );
  }
);

CustomCanvas.displayName = "CustomCanvas";

export default CustomCanvas;
export type { CustomCanvasDraft, CustomCanvasRef, CustomCanvasProps } from "./types";
