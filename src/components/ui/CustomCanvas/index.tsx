import React, { useRef, forwardRef, useImperativeHandle, useEffect } from "react";
import { useCanvasState } from "./hooks/useCanvasState";
import { useCanvasHistory } from "./hooks/useCanvasHistory";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { DesktopToolbar } from "./components/DesktopToolbar";
import { MobileToolbar } from "./components/MobileToolbar";
import { ClearConfirmModal } from "./components/ClearConfirmModal";
import { TextInputOverlay } from "./components/TextInputOverlay";
import { CustomCanvasProps, CustomCanvasRef, DrawingElement, Tool } from "./types";
import { getMousePosition, calculateElementBounds, isPointInElement, isPointInsideShape } from "./utils/canvasUtils";
import { drawElement } from "./utils/drawingUtils";
import { DEFAULT_CANVAS_SIZE, DRAG_THRESHOLD } from "./constants";

const CustomCanvas = forwardRef<CustomCanvasRef, CustomCanvasProps>(
  ({ width = DEFAULT_CANVAS_SIZE, height = DEFAULT_CANVAS_SIZE }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const state = useCanvasState();
    const history = useCanvasHistory();

    // Destructure state for easier access
    const {
      isDrawing, tool, color, lineWidth, elements, currentElement,
      textInput, showTextInput, textPosition, fontSize, fontFamily,
      showClearConfirm, canvasBackground, penStyle, selectedElement, 
      selectedElements, selectionBox, hoveredElement, dragOffset, 
      resizeHandle, originalSize, customColor, isMobile, setIsDrawing, 
      setTool, setColor, setElements, setCurrentElement, setTextInput, 
      setShowTextInput, setTextPosition, setFontSize, setFontFamily, 
      setShowClearConfirm, setPenStyle, setSelectedElement, setSelectedElements,
      setSelectionBox, setHoveredElement, setDragOffset, setResizeHandle, 
      setOriginalSize, setCustomColor, setIsMobile, setLineWidth,
      lastClickTime, lastClickElement, dragStartPos, isDragging, imageCache,
    } = state;

    // Check if mobile
    useEffect(() => {
      setIsMobile(window.innerWidth < 768);
      const handleResize = () => setIsMobile(window.innerWidth < 768);
      window.addEventListener("resize", handleResize);
      return () => window.removeEventListener("resize", handleResize);
    }, [setIsMobile]);

    // Keyboard shortcuts
    useKeyboardShortcuts({
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
        drawElement(ctx, element, imageCache.current);
      });

      // Draw current element being created
      if (currentElement) {
        drawElement(ctx, currentElement, imageCache.current);
      }

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
    }, [elements, currentElement, selectedElement, selectedElements, selectionBox, hoveredElement, canvasBackground, isDrawing, imageCache, tool]);

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
        color,
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

    function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        const imageDataUrl = event.target?.result as string;
        const img = new Image();
        img.onload = () => {
          const maxSize = 300;
          let w = img.naturalWidth;
          let h = img.naturalHeight;

          if (w > maxSize || h > maxSize) {
            const ratio = w / h;
            if (w > h) {
              w = maxSize;
              h = maxSize / ratio;
            } else {
              h = maxSize;
              w = maxSize * ratio;
            }
          }

          const newElement: DrawingElement = {
            type: "image",
            color,
            lineWidth,
            imageData: imageDataUrl,
            startPoint: { x: 100, y: 100 },
            width: w,
            height: h,
          };

          const newElements = [...elements, newElement];
          setElements(newElements);
          history.addToHistory(newElements);
          setTool("select");
          setSelectedElement(newElements.length - 1);
        };
        img.src = imageDataUrl;
      };
      reader.readAsDataURL(file);
    }

    function handleDownload() {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const dataUrl = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.download = `drawing-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
    }

    // Expose methods via ref
    useImperativeHandle(ref, () => ({
      exportImage: async () => {
        const canvas = canvasRef.current;
        if (!canvas) return null;
        
        // Create a temporary canvas with exact dimensions
        const tempCanvas = document.createElement("canvas");
        tempCanvas.width = width;
        tempCanvas.height = height;
        const tempCtx = tempCanvas.getContext("2d");
        if (!tempCtx) return null;

        // Draw background
        tempCtx.fillStyle = canvasBackground;
        tempCtx.fillRect(0, 0, width, height);

        // Draw all elements
        elements.forEach((element) => {
          drawElement(tempCtx, element, imageCache.current);
        });

        return tempCanvas.toDataURL("image/png");
      },
      clearCanvas: handleClearConfirmed,
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

    function handleMouseDown(e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) {
      const canvas = canvasRef.current;
      if (!canvas) return;
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

            const handles = [
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
                setResizeHandle(handle.name as any);
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
              setColor(elements[i].color);
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
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        // Find element to fill (use precise inside check)
        let elementFilled = false;
        for (let i = elements.length - 1; i >= 0; i--) {
          const element = elements[i];
          
          // Check fillable shapes
          if (
            element.type === "rectangle" ||
            element.type === "circle" ||
            element.type === "triangle" ||
            element.type === "star"
          ) {
            // Use precise inside check for fill
            if (isPointInsideShape(point, element)) {
              const newElements = [...elements];
              newElements[i] = {
                ...element,
                filled: true,
                fillColor: color,
              };
              setElements(newElements);
              history.addToHistory(newElements);
              elementFilled = true;
              break;
            }
          }
          
          // Check if clicked on line element
          if (element.type === "line" && isPointInElement(point, element, ctx)) {
            // Lines cannot be filled, just show a message or ignore
            elementFilled = true;
            break;
          }
        }
        
        if (elementFilled) return;

        // If no shape was clicked, fill canvas background
        const backgroundRect: DrawingElement = {
          type: "rectangle",
          startPoint: { x: 0, y: 0 },
          endPoint: { x: width, y: height },
          color: color,
          lineWidth: 0,
          filled: true,
          fillColor: color,
          opacity: 1,
        };

        // Remove any existing background rectangles (check by lineWidth: 0 and full canvas size)
        const filteredElements = elements.filter((el) => {
          if (el.type === "rectangle" && el.lineWidth === 0 && el.startPoint && el.endPoint) {
            // Check if it's approximately full canvas (with small tolerance)
            const isBackground =
              Math.abs(el.startPoint.x) < 1 &&
              Math.abs(el.startPoint.y) < 1 &&
              Math.abs(el.endPoint.x - width) < 1 &&
              Math.abs(el.endPoint.y - height) < 1;
            return !isBackground; // Remove background rectangles
          }
          return true;
        });

        const newElements = [backgroundRect, ...filteredElements];
        setElements(newElements);
        history.addToHistory(newElements);
        return;
      }

      setIsDrawing(true);

      if (tool === "pen") {
        const settings = getPenStyleSettings();
        setCurrentElement({
          type: "line",
          color: color,
          lineWidth: settings.lineWidth,
          opacity: settings.opacity,
          points: [point],
        });
      } else if (tool === "eraser") {
        // Eraser mode - we'll handle erasing in mouse move
        setIsDrawing(true);
        return;
      } else {
        setCurrentElement({
          type: tool as any,
          color,
          lineWidth,
          opacity: 1,
          startPoint: point,
          endPoint: point,
        });
      }
    }

    function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) {
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

      // Handle eraser - remove elements
      if (tool === "eraser" && isDrawing) {
        const eraserRadius = lineWidth * 3;
        const newElements = elements.filter((element) => {
          // Check if any point of the element is within eraser radius
          if (element.points && element.points.length > 0) {
            // For line elements, check each segment
            for (let i = 0; i < element.points.length; i++) {
              const p = element.points[i];
              const dist = Math.sqrt(
                Math.pow(point.x - p.x, 2) + Math.pow(point.y - p.y, 2)
              );
              if (dist <= eraserRadius) {
                return false; // Remove this element
              }
            }
          } else if (element.startPoint) {
            // For other elements, check if eraser touches their bounds
            const bounds = calculateElementBounds(element, ctx);
            const isNearElement =
              point.x >= bounds.x - eraserRadius &&
              point.x <= bounds.x + bounds.width + eraserRadius &&
              point.y >= bounds.y - eraserRadius &&
              point.y <= bounds.y + bounds.height + eraserRadius;
            
            if (isNearElement) {
              // More precise check based on element type
              if (element.type === "text" || element.type === "image") {
                return !isPointInElement(point, element, ctx);
              }
              return false; // Remove shapes if touched
            }
          }
          return true; // Keep this element
        });

        if (newElements.length !== elements.length) {
          setElements(newElements);
        }
        return;
      }

      if (!isDrawing || !currentElement) return;

      if (tool === "pen") {
        setCurrentElement({
          ...currentElement,
          points: [...(currentElement.points || []), point],
        });
      } else {
        setCurrentElement({
          ...currentElement,
          endPoint: point,
        });
      }
    }

    function handleMouseUp() {
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

      // Eraser - add to history
      if (tool === "eraser") {
        history.addToHistory([...elements]);
        return;
      }

      if (!currentElement) return;

      const newElements = [...elements, currentElement];
      setElements(newElements);
      history.addToHistory(newElements);
      setCurrentElement(null);
    }

    return (
      <div className="w-full max-w-7xl mx-auto md:space-y-3">
        <div className="flex flex-col md:flex-row md:gap-3 relative z-0">
          <div className="flex-1">
            <div className="hand-drawn-card overflow-hidden md:rounded-xl rounded-none" style={{ padding: 0 }}>
              <div 
                className="w-full flex items-center justify-center bg-gray-50 relative" 
                style={{ 
                  margin: 0, 
                  padding: 0,
                  aspectRatio: "1 / 1",
                  minHeight: isMobile ? "min(90vw, 600px)" : "auto",
                }}
              >
                <canvas
                  ref={canvasRef}
                  width={width}
                  height={height}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                  onTouchStart={handleMouseDown}
                  onTouchMove={handleMouseMove}
                  onTouchEnd={handleMouseUp}
                  className="bg-white touch-none"
                  style={{
                    cursor: tool === "pen" ? "crosshair" : tool === "eraser" ? "cell" : tool === "select" ? "pointer" : tool === "fill" ? "crosshair" : "default",
                    width: "100%",
                    height: "100%",
                    display: "block",
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
              onColorChange={setColor}
              onLineWidthChange={setLineWidth}
              onPenStyleChange={setPenStyle}
              onUndo={handleUndo}
              onRedo={handleRedo}
              onClear={() => setShowClearConfirm(true)}
              onDownload={handleDownload}
              onImageUpload={handleImageUpload}
              historyStep={history.historyStep}
              historyLength={history.history.length}
            />
          </div>

          <DesktopToolbar
            tool={tool}
            color={color}
            customColor={customColor}
            lineWidth={lineWidth}
            penStyle={penStyle}
            fontSize={fontSize}
            fontFamily={fontFamily}
            historyStep={history.historyStep}
            historyLength={history.history.length}
            onToolChange={setTool}
            onColorChange={setColor}
            onCustomColorChange={setCustomColor}
            onLineWidthChange={setLineWidth}
            onPenStyleChange={setPenStyle}
            onUndo={handleUndo}
            onRedo={handleRedo}
            onClear={() => setShowClearConfirm(true)}
            onDownload={handleDownload}
            onImageUpload={handleImageUpload}
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
export type { CustomCanvasRef, CustomCanvasProps };

