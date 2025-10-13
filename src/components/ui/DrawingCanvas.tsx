import React, { useRef, useEffect, useState } from 'react';

interface DrawingCanvasProps {
  width?: number;
  height?: number;
  onImageChange?: (imageData: string) => void;
  className?: string;
  showTools?: boolean;
  onToolsRender?: (tools: React.ReactNode) => void;
  toolsVariant?: 'full' | 'compact';
}

const DrawingCanvas: React.FC<DrawingCanvasProps> = ({ 
  width = 1024, 
  height = 1024, 
  onImageChange,
  className = '',
  showTools = true,
  onToolsRender,
  toolsVariant = 'full'
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentTool, setCurrentTool] = useState<'brush' | 'eraser' | 'fill' | 'line' | 'shape' | 'eyedropper' | 'text'>('brush');
  const [currentColor, setCurrentColor] = useState('#000000');
  const [brushSize, setBrushSize] = useState(8);
  const [showCustomColor, setShowCustomColor] = useState(false);
  const [currentShape, setCurrentShape] = useState<'rectangle' | 'circle' | 'triangle'>('rectangle');
  const [startPoint, setStartPoint] = useState<{x: number, y: number} | null>(null);
  const [previewPoint, setPreviewPoint] = useState<{x: number, y: number} | null>(null);
  const baseImageDataRef = useRef<ImageData | null>(null);
  const [shapeFill, setShapeFill] = useState<boolean>(false);
  const [fillTolerance, setFillTolerance] = useState<number>(20);
  const [textValue, setTextValue] = useState<string>('Text');
  const [textSize, setTextSize] = useState<number>(32);
  const [undoStack, setUndoStack] = useState<string[]>([]);
  const [redoStack, setRedoStack] = useState<string[]>([]);
  const [zoom, setZoom] = useState<number>(1);
  

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas background to white
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    // Set default drawing styles
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Initialize undo stack with a blank state
    const initialData = canvas.toDataURL('image/png');
    setUndoStack([initialData]);
    setRedoStack([]);
  }, [width, height]);

  // Handle window resize to ensure proper coordinate calculation
  useEffect(() => {
    const handleResize = () => {
      // Force a re-render to recalculate coordinates
      const canvas = canvasRef.current;
      if (canvas) {
        // Trigger a small redraw to ensure coordinates are updated
        const ctx = canvas.getContext('2d');
        if (ctx) {
          // Just trigger the onImageChange callback to update parent
          if (onImageChange) {
            onImageChange(canvas.toDataURL('image/png'));
          }
        }
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [onImageChange]);

  const getEventPos = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    // Calculate scale factors for CSS scaling
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    // Ensure coordinates are within canvas bounds
    const x = Math.max(0, Math.min(canvas.width, (clientX - rect.left) * scaleX));
    const y = Math.max(0, Math.min(canvas.height, (clientY - rect.top) * scaleY));
    
    return { x, y };
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getEventPos(e);

    // Eyedropper
    if (currentTool === 'eyedropper') {
      const color = sampleColorAt(x, y);
      if (color) {
        const hex = rgbaToHex(color.r, color.g, color.b, color.a);
        setCurrentColor(hex);
        setCurrentTool('brush');
      }
      return;
    }


    // Snapshot for undo
    pushUndoSnapshot();

    if (currentTool === 'line' || currentTool === 'shape') {
      // Capture base image for non-destructive preview
      baseImageDataRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height);
      // For line and shape tools, just store the start point
      setStartPoint({ x, y });
      setIsDrawing(true);
    } else if (currentTool === 'text') {
      baseImageDataRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height);
      setStartPoint({ x, y });
      setIsDrawing(true);
    } else if (currentTool === 'fill') {
      // For fill tool, fill the area immediately
      fillArea(x, y);
    } else {
      // For brush and eraser, start drawing
      setIsDrawing(true);
      ctx.beginPath();
      ctx.moveTo(x, y);
    }
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getEventPos(e);


    if (!isDrawing) return;

    if (currentTool === 'brush' || currentTool === 'eraser') {
      // For brush and eraser, continue drawing
      ctx.lineWidth = brushSize;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (currentTool === 'brush') {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = currentColor;
      } else if (currentTool === 'eraser') {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = '#ffffff';
      }

      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, y);

      // Notify parent of image change
      if (onImageChange) {
        onImageChange(canvas.toDataURL('image/png'));
      }
    } else if ((currentTool === 'line' || currentTool === 'shape') && startPoint) {
      // For line and shape tools, update preview
      setPreviewPoint({ x, y });
      redrawWithPreview();
    } else if (currentTool === 'text' && startPoint) {
      setPreviewPoint({ x, y });
      redrawWithPreview();
    }
  };

  const stopDrawing = (e?: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (currentTool === 'line' && startPoint && e) {
      const { x, y } = getEventPos(e);
      drawLine(startPoint.x, startPoint.y, x, y);
    } else if (currentTool === 'shape' && startPoint && e) {
      const { x, y } = getEventPos(e);
      drawShape(startPoint.x, startPoint.y, x, y);
    } else if (currentTool === 'text' && startPoint && e) {
      const { x, y } = getEventPos(e);
      drawTextAt(x, y);
    }

    setIsDrawing(false);
    setStartPoint(null);
    setPreviewPoint(null);
    baseImageDataRef.current = null;
  };

  const fillArea = (x: number, y: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Simple flood fill implementation
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    const ix = Math.floor(x); const iy = Math.floor(y);
    const targetColor = getPixelColor(data, ix, iy, canvas.width);
    const fillColor = hexToRgba(currentColor);

    if (colorsEqual(targetColor, fillColor)) return;

    const stack = [{ x: ix, y: iy }];
    const visited = new Set<string>();

    while (stack.length > 0) {
      const { x: currentX, y: currentY } = stack.pop()!;
      const key = `${currentX},${currentY}`;

      if (visited.has(key) || currentX < 0 || currentX >= canvas.width || currentY < 0 || currentY >= canvas.height) {
        continue;
      }

      visited.add(key);
      const currentColor = getPixelColor(data, currentX, currentY, canvas.width);

      if (!colorsWithinTolerance(currentColor, targetColor, fillTolerance)) {
        continue;
      }

      setPixelColor(data, currentX, currentY, fillColor, canvas.width);
      stack.push({ x: currentX + 1, y: currentY });
      stack.push({ x: currentX - 1, y: currentY });
      stack.push({ x: currentX, y: currentY + 1 });
      stack.push({ x: currentX, y: currentY - 1 });
    }

    ctx.putImageData(imageData, 0, 0);

    if (onImageChange) {
      onImageChange(canvas.toDataURL('image/png'));
    }
  };

  const drawLine = (x1: number, y1: number, x2: number, y2: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineWidth = brushSize;
    ctx.strokeStyle = currentColor;
    ctx.lineCap = 'round';
    ctx.stroke();

    if (onImageChange) {
      onImageChange(canvas.toDataURL('image/png'));
    }
  };

  const drawShape = (x1: number, y1: number, x2: number, y2: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = x2 - x1;
    const height = y2 - y1;

    ctx.beginPath();
    ctx.lineWidth = brushSize;
    ctx.strokeStyle = currentColor;
    ctx.fillStyle = currentColor;
    ctx.lineCap = 'round';

    switch (currentShape) {
      case 'rectangle':
        ctx.rect(x1, y1, width, height);
        break;
      case 'circle':
        const radius = Math.sqrt(width * width + height * height) / 2;
        ctx.arc(x1 + width / 2, y1 + height / 2, radius, 0, 2 * Math.PI);
        break;
      case 'triangle':
        ctx.moveTo(x1 + width / 2, y1);
        ctx.lineTo(x1, y2);
        ctx.lineTo(x2, y2);
        ctx.closePath();
        break;
    }

    if (shapeFill) {
      ctx.fill();
    } else {
      ctx.stroke();
    }

    if (onImageChange) {
      onImageChange(canvas.toDataURL('image/png'));
    }
  };

  const drawTextAt = (x: number, y: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.save();
    ctx.fillStyle = currentColor;
    ctx.textBaseline = 'top';
    ctx.font = `${textSize}px Kalam, Arial, sans-serif`;
    ctx.fillText(textValue, x, y);
    ctx.restore();
    
    
    if (onImageChange) {
      onImageChange(canvas.toDataURL('image/png'));
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);
    
    // Redraw background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);


    if (onImageChange) {
      onImageChange(canvas.toDataURL('image/png'));
    }
  };

  const getImageData = () => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    return canvas.toDataURL('image/png');
  };

  const pushUndoSnapshot = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    setUndoStack((prev) => {
      const next = [...prev, dataUrl];
      if (next.length > 20) next.shift();
      return next;
    });
    setRedoStack([]);
  };


  const undo = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (undoStack.length <= 1) return;
    const current = canvas.toDataURL('image/png');
    const prevState = undoStack[undoStack.length - 2];
    setRedoStack((r) => [current, ...r]);
    setUndoStack((u) => u.slice(0, u.length - 1));
    loadFromDataURL(prevState);
  };

  const redo = () => {
    const nextState = redoStack[0];
    if (!nextState) return;
    setRedoStack((r) => r.slice(1));
    setUndoStack((u) => [...u, nextState]);
    loadFromDataURL(nextState);
  };

  const loadFromDataURL = (dataUrl: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      if (onImageChange) onImageChange(canvas.toDataURL('image/png'));
    };
    img.src = dataUrl;
  };

  // Helper functions for flood fill
  const getPixelColor = (data: Uint8ClampedArray, x: number, y: number, width: number) => {
    const index = (y * width + x) * 4;
    return {
      r: data[index],
      g: data[index + 1],
      b: data[index + 2],
      a: data[index + 3]
    };
  };

  const setPixelColor = (data: Uint8ClampedArray, x: number, y: number, color: {r: number, g: number, b: number, a: number}, width: number) => {
    const index = (y * width + x) * 4;
    data[index] = color.r;
    data[index + 1] = color.g;
    data[index + 2] = color.b;
    data[index + 3] = color.a;
  };

  const colorsEqual = (color1: {r: number, g: number, b: number, a: number}, color2: {r: number, g: number, b: number, a: number}) => {
    return color1.r === color2.r && color1.g === color2.g && color1.b === color2.b && color1.a === color2.a;
  };

  const colorsWithinTolerance = (
    color1: {r: number, g: number, b: number, a: number},
    color2: {r: number, g: number, b: number, a: number},
    tolerance: number
  ) => {
    const dr = color1.r - color2.r;
    const dg = color1.g - color2.g;
    const db = color1.b - color2.b;
    const distance = Math.sqrt(dr*dr + dg*dg + db*db);
    return distance <= tolerance;
  };

  const hexToRgba = (hex: string) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return { r, g, b, a: 255 };
  };

  const rgbaToHex = (r: number, g: number, b: number, a: number) => {
    const toHex = (n: number) => n.toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  };

  const sampleColorAt = (x: number, y: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    const imageData = ctx.getImageData(Math.floor(x), Math.floor(y), 1, 1);
    const d = imageData.data;
    return { r: d[0], g: d[1], b: d[2], a: d[3] };
  };

  const redrawWithPreview = () => {
    const canvas = canvasRef.current;
    if (!canvas || !startPoint || !previewPoint) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Restore from base snapshot to avoid ghosting
    if (baseImageDataRef.current) {
      ctx.putImageData(baseImageDataRef.current, 0, 0);
    }
    
    // Draw preview
    ctx.save();
    ctx.globalAlpha = 0.6; // Semi-transparent preview
    ctx.lineWidth = brushSize;
    ctx.strokeStyle = currentColor;
    ctx.lineCap = 'round';
    ctx.fillStyle = currentColor;
    
    if (currentTool === 'line') {
      ctx.beginPath();
      ctx.moveTo(startPoint.x, startPoint.y);
      ctx.lineTo(previewPoint.x, previewPoint.y);
      ctx.stroke();
    } else if (currentTool === 'shape') {
      const width = previewPoint.x - startPoint.x;
      const height = previewPoint.y - startPoint.y;
      
      ctx.beginPath();
      
      switch (currentShape) {
        case 'rectangle':
          ctx.rect(startPoint.x, startPoint.y, width, height);
          break;
        case 'circle':
          const radius = Math.sqrt(width * width + height * height) / 2;
          ctx.arc(startPoint.x + width / 2, startPoint.y + height / 2, radius, 0, 2 * Math.PI);
          break;
        case 'triangle':
          ctx.moveTo(startPoint.x + width / 2, startPoint.y);
          ctx.lineTo(startPoint.x, previewPoint.y);
          ctx.lineTo(previewPoint.x, previewPoint.y);
          ctx.closePath();
          break;
      }
      
      if (shapeFill) {
        ctx.fill();
      } else {
        ctx.stroke();
      }
    } else if (currentTool === 'text') {
      ctx.font = `${textSize}px Kalam, Arial, sans-serif`;
      ctx.textBaseline = 'top';
      ctx.fillText(textValue, previewPoint.x, previewPoint.y);
    }
    
    ctx.restore();
  };

  const colors = [
    '#000000', '#FF0000', '#00FF00', '#0000FF', 
    '#FFFF00', '#FF00FF', '#00FFFF', '#FFA500',
    '#800080', '#008000', '#FFC0CB', '#A52A2A'
  ];

  // Create tools component
  const toolsComponent = (
    <div className={`space-y-3 ${toolsVariant === 'compact' ? 'pt-1' : ''}`}>
      {/* Primary Toolbar */}
      <div className={`flex items-center ${toolsVariant === 'compact' ? 'gap-1 overflow-x-auto no-scrollbar py-1' : 'gap-2 flex-wrap'}`}>
        <button className={`hand-drawn-btn tool-btn text-xs md:text-sm px-2 py-1 md:px-3 md:py-2 ${currentTool === 'brush' ? 'secondary' : ''}`} onClick={() => setCurrentTool('brush')} title="Brush">
          <svg className="w-4 h-4" viewBox="0 0 24 24"><path d="M7 14c-1.66 0-3 1.34-3 3 0 1.31-1.16 2-2 2 .92 1.22 2.49 2 4 2 2.21 0 4-1.79 4-4 0-1.66-1.34-3-3-3z" /><path d="M20.71 4.63l-1.34-1.34c-.39-.39-1.02-.39-1.41 0L9 12.25 11.75 15l8.96-8.96c.39-.39.39-1.02 0-1.41z" /></svg>
          {toolsVariant === 'full' && <span className="ml-1">Brush</span>}
        </button>
        <button className={`hand-drawn-btn tool-btn text-xs md:text-sm px-2 py-1 md:px-3 md:py-2 ${currentTool === 'eraser' ? 'secondary' : ''}`} onClick={() => setCurrentTool('eraser')} title="Eraser">
          <svg className="w-4 h-4" viewBox="0 0 24 24"><path d="M16.24 3.56l4.95 4.94c.78.79.78 2.05 0 2.84L12 20.53a4.008 4.008 0 0 1-5.66 0L2.81 17c-.78-.79-.78-2.05 0-2.84l10.6-10.6c.79-.78 2.05-.78 2.83 0M4.22 15.58l3.54 3.53c.78.79 2.04.79 2.83 0l3.53-3.53-6.36-6.36-3.54 3.36z" /></svg>
          {toolsVariant === 'full' && <span className="ml-1">Eraser</span>}
        </button>
        <button className={`hand-drawn-btn tool-btn text-xs md:text-sm px-2 py-1 md:px-3 md:py-2 ${currentTool === 'fill' ? 'secondary' : ''}`} onClick={() => setCurrentTool('fill')} title="Fill">
          <svg className="w-4 h-4" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
          {toolsVariant === 'full' && <span className="ml-1">Fill</span>}
        </button>
        <button className={`hand-drawn-btn tool-btn text-xs md:text-sm px-2 py-1 md:px-3 md:py-2 ${currentTool === 'line' ? 'secondary' : ''}`} onClick={() => setCurrentTool('line')} title="Line">
          <svg className="w-4 h-4" viewBox="0 0 24 24"><path d="M3 12h18m-9-9l9 9-9 9" /></svg>
          {toolsVariant === 'full' && <span className="ml-1">Line</span>}
        </button>
        <button className={`hand-drawn-btn tool-btn text-xs md:text-sm px-2 py-1 md:px-3 md:py-2 ${currentTool === 'shape' ? 'secondary' : ''}`} onClick={() => setCurrentTool('shape')} title="Shape">
          <svg className="w-4 h-4" viewBox="0 0 24 24"><path d="M3 3h18v18H3V3zm2 2v14h14V5H5z" /></svg>
          {toolsVariant === 'full' && <span className="ml-1">Shape</span>}
        </button>
        <button className={`hand-drawn-btn tool-btn text-xs md:text-sm px-2 py-1 md:px-3 md:py-2 ${currentTool === 'text' ? 'secondary' : ''}`} onClick={() => setCurrentTool('text')} title="Text">
          <svg className="w-4 h-4" viewBox="0 0 24 24"><path d="M4 4h16v2H13v14h-2V6H4z" /></svg>
          {toolsVariant === 'full' && <span className="ml-1">Text</span>}
        </button>
        <button className={`hand-drawn-btn tool-btn text-xs md:text-sm px-2 py-1 md:px-3 md:py-2 ${currentTool === 'eyedropper' ? 'secondary' : ''}`} onClick={() => setCurrentTool('eyedropper')} title="Eyedropper">
          <svg className="w-4 h-4" viewBox="0 0 24 24"><path d="M14.828 2.586a2 2 0 012.828 0l3.758 3.758a2 2 0 010 2.828l-3.536 3.536-1.414-1.414 2.121-2.121-2.344-2.344-2.121 2.121-1.414-1.414 2.122-2.122-1-1zM4 16l6-6 4 4-6 6H4v-4z"/></svg>
          {toolsVariant === 'full' && <span className="ml-1">Pick</span>}
        </button>

      </div>

      {/* Actions Row (separate for compact) */}
      <div className={`flex items-center ${toolsVariant === 'compact' ? 'gap-2 py-1' : 'gap-2'}`}>
        <button className="hand-drawn-btn tool-btn text-xs px-2 py-1" onClick={undo} title="Undo" disabled={undoStack.length <= 1}>
          <svg className="w-4 h-4" viewBox="0 0 24 24"><path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6a6 6 0 01-6 6H6v2h6a8 8 0 000-16z"/></svg>
        </button>
        <button className="hand-drawn-btn tool-btn text-xs px-2 py-1" onClick={redo} title="Redo" disabled={redoStack.length === 0}>
          <svg className="w-4 h-4" viewBox="0 0 24 24"><path d="M12 5V1l5 5-5 5V7C8.69 7 6 9.69 6 13a6 6 0 006 6h6v2h-6a8 8 0 010-16z"/></svg>
        </button>
        <button className="hand-drawn-btn tool-btn danger text-xs px-2 py-1" onClick={() => { pushUndoSnapshot(); clearCanvas(); }} title="Clear">
          <svg className="w-4 h-4" viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" /></svg>
        </button>
        <button className="hand-drawn-btn tool-btn text-xs px-2 py-1" onClick={() => { const canvas = canvasRef.current; if (canvas) { const link = document.createElement('a'); link.download = 'drawing.png'; link.href = canvas.toDataURL(); link.click(); } }} title="Download">
          <svg className="w-4 h-4" viewBox="0 0 24 24"><path d="M5 20h14v-2H5v2zm7-18L8.5 7H11v6h2V7h2.5L12 2z"/></svg>
        </button>
      </div>

      {/* Removed mobile quick colors; using unified palette */}

      {/* Secondary Controls */}
      {toolsVariant === 'compact' ? (
        <div className="rounded-md bg-art-gray-50 border border-art-gray-200 p-2">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-art-gray-600">Size:</span>
              <input type="range" min="2" max="30" value={brushSize} onChange={(e) => setBrushSize(Number(e.target.value))} className="flex-1 h-1" />
              <span className="text-xs font-mono w-8">{brushSize}px</span>
            </div>
            {currentTool === 'shape' && (
              <div className="space-y-2">
                <span className="text-xs text-art-gray-600">Shape:</span>
                <div className="flex gap-1">
                  <button className={`hand-drawn-btn text-xs px-2 py-1 ${currentShape === 'rectangle' ? 'secondary' : ''}`} onClick={() => setCurrentShape('rectangle')} title="Rectangle">
                    <svg className="w-3 h-3" viewBox="0 0 24 24"><path d="M3 3h18v18H3V3zm2 2v14h14V5H5z" /></svg>
                  </button>
                  <button className={`hand-drawn-btn text-xs px-2 py-1 ${currentShape === 'circle' ? 'secondary' : ''}`} onClick={() => setCurrentShape('circle')} title="Circle">
                    <svg className="w-3 h-3" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z" /></svg>
                  </button>
                  <button className={`hand-drawn-btn text-xs px-2 py-1 ${currentShape === 'triangle' ? 'secondary' : ''}`} onClick={() => setCurrentShape('triangle')} title="Triangle">
                    <svg className="w-3 h-3" viewBox="0 0 24 24"><path d="M12 2l9 18H3l9-18z" /></svg>
                  </button>
                </div>
              </div>
            )}
            {currentTool === 'text' && (
              <div className="space-y-2">
                <span className="text-xs text-art-gray-600">Text:</span>
                <input type="text" value={textValue} onChange={(e) => setTextValue(e.target.value)} className="hand-drawn-input" />
                <div className="flex items-center gap-2">
                  <span className="text-xs text-art-gray-600">Size:</span>
                  <input type="range" min="12" max="72" value={textSize} onChange={(e) => setTextSize(Number(e.target.value))} className="flex-1 h-1" />
                  <span className="text-xs font-mono w-10">{textSize}px</span>
                </div>
              </div>
            )}
            {currentTool === 'shape' && (
              <label className="flex items-center gap-2 text-xs text-art-gray-700">
                <input type="checkbox" checked={shapeFill} onChange={(e) => setShapeFill(e.target.checked)} />
                Fill Shape
              </label>
            )}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-art-gray-600">Colors:</span>
                <button className="text-xs text-blue-600 hover:text-blue-800 underline" onClick={() => setShowCustomColor(!showCustomColor)}>Custom</button>
              </div>
              {showCustomColor && (
                <div className="flex items-center gap-2 p-2 bg-white rounded-lg border border-art-gray-200">
                  <input type="color" value={currentColor} onChange={(e) => setCurrentColor(e.target.value)} className="w-8 h-6 rounded border border-art-gray-300" />
                  <span className="text-xs font-mono text-art-gray-600">{currentColor}</span>
                </div>
              )}
              <div className="grid grid-cols-6 md:grid-cols-12 gap-1">
                {colors.map((color) => (
                  <button key={color} className={`color-picker relative ${currentColor === color ? 'ring-2 ring-blue-500 scale-110' : 'hover:scale-105'}`} style={{ backgroundColor: color, width: '20px', height: '20px', minWidth: '20px', minHeight: '20px', transition: 'transform 0.2s ease, box-shadow 0.2s ease', borderRadius: '4px' }} onClick={() => { setCurrentColor(color); setShowCustomColor(false); }} title={color}>
                    {currentColor === color && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <svg className="w-3 h-3 text-white drop-shadow-lg" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-art-gray-600">Fill tol.:</span>
              <input type="range" min="0" max="80" step="1" value={fillTolerance} onChange={(e) => setFillTolerance(Number(e.target.value))} className="flex-1 h-1" />
              <span className="text-xs font-mono w-10">{fillTolerance}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-art-gray-600">Zoom:</span>
              <input type="range" min="0.5" max="3" step="0.1" value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="flex-1 h-1" />
              <span className="text-xs font-mono w-10">{Math.round(zoom * 100)}%</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-art-gray-600">Size:</span>
            <input type="range" min="2" max="30" value={brushSize} onChange={(e) => setBrushSize(Number(e.target.value))} className="flex-1 h-1" />
            <span className="text-xs font-mono w-8">{brushSize}px</span>
          </div>
          {currentTool === 'shape' && (
            <label className="flex items-center gap-2 text-xs text-art-gray-700">
              <input type="checkbox" checked={shapeFill} onChange={(e) => setShapeFill(e.target.checked)} />
              Fill Shape
            </label>
          )}
          {currentTool === 'text' && (
            <div className="space-y-2">
              <span className="text-xs text-art-gray-600">Text:</span>
              <input type="text" value={textValue} onChange={(e) => setTextValue(e.target.value)} className="hand-drawn-input" />
              <div className="flex items-center gap-2">
                <span className="text-xs text-art-gray-600">Size:</span>
                <input type="range" min="12" max="72" value={textSize} onChange={(e) => setTextSize(Number(e.target.value))} className="flex-1 h-1" />
                <span className="text-xs font-mono w-10">{textSize}px</span>
              </div>
            </div>
          )}
          {currentTool === 'shape' && (
            <div className="space-y-2">
              <span className="text-xs text-art-gray-600">Shape:</span>
              <div className="flex gap-1">
                <button className={`hand-drawn-btn text-xs px-2 py-1 ${currentShape === 'rectangle' ? 'secondary' : ''}`} onClick={() => setCurrentShape('rectangle')} title="Rectangle">
                  <svg className="w-3 h-3" viewBox="0 0 24 24"><path d="M3 3h18v18H3V3zm2 2v14h14V5H5z" /></svg>
                </button>
                <button className={`hand-drawn-btn text-xs px-2 py-1 ${currentShape === 'circle' ? 'secondary' : ''}`} onClick={() => setCurrentShape('circle')} title="Circle">
                  <svg className="w-3 h-3" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z" /></svg>
                </button>
                <button className={`hand-drawn-btn text-xs px-2 py-1 ${currentShape === 'triangle' ? 'secondary' : ''}`} onClick={() => setCurrentShape('triangle')} title="Triangle">
                  <svg className="w-3 h-3" viewBox="0 0 24 24"><path d="M12 2l9 18H3l9-18z" /></svg>
                </button>
              </div>
            </div>
          )}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-art-gray-600">Colors:</span>
              <button className="text-xs text-blue-600 hover:text-blue-800 underline" onClick={() => setShowCustomColor(!showCustomColor)}>Custom</button>
            </div>
            {showCustomColor && (
              <div className="flex items-center gap-2 p-2 bg-art-gray-50 rounded-lg">
                <input type="color" value={currentColor} onChange={(e) => setCurrentColor(e.target.value)} className="w-8 h-6 rounded border border-art-gray-300" />
                <span className="text-xs font-mono text-art-gray-600">{currentColor}</span>
              </div>
            )}
            <div className="grid grid-cols-6 md:grid-cols-12 gap-1">
              {colors.map((color) => (
                <button key={color} className={`color-picker relative ${currentColor === color ? 'ring-2 ring-blue-500 scale-110' : 'hover:scale-105'}`} style={{ backgroundColor: color, width: '20px', height: '20px', minWidth: '20px', minHeight: '20px', transition: 'transform 0.2s ease, box-shadow 0.2s ease', borderRadius: '4px' }} onClick={() => { setCurrentColor(color); setShowCustomColor(false); }} title={color}>
                {currentColor === color && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <svg className="w-3 h-3 text-white drop-shadow-lg" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                  </div>
                )}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-art-gray-600">Fill tol.:</span>
            <input type="range" min="0" max="80" step="1" value={fillTolerance} onChange={(e) => setFillTolerance(Number(e.target.value))} className="flex-1 h-1" />
            <span className="text-xs font-mono w-10">{fillTolerance}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-art-gray-600">Zoom:</span>
            <input type="range" min="0.5" max="3" step="0.1" value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="flex-1 h-1" />
            <span className="text-xs font-mono w-10">{Math.round(zoom * 100)}%</span>
          </div>
        </div>
      )}
    </div>
  );

  // Call onToolsRender if provided
  useEffect(() => {
    if (onToolsRender) {
      onToolsRender(toolsComponent);
    }
  }, [currentTool, brushSize, currentColor, currentShape, showCustomColor, undoStack, redoStack, zoom, textValue, textSize, toolsVariant, onToolsRender]);

  return (
    <div className={`drawing-canvas p-2 ${className}`}>
      <div className="w-full max-w-full overflow-hidden flex justify-center ">
        <div className="relative" style={{ maxWidth: '100%', maxHeight: '80vh', transform: `scale(${zoom})`, transformOrigin: 'center center' }}>
          <canvas
            ref={canvasRef}
            width={width}
            height={height}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={() => stopDrawing()}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
            style={{ 
              cursor: 'crosshair', 
              touchAction: 'none',
              maxWidth: '100%',
              maxHeight: '80vh',
              width: 'auto',
              height: 'auto',
              backgroundColor: '#ffffff',
              display: 'block',
              userSelect: 'none',
              WebkitUserSelect: 'none',
              MozUserSelect: 'none',
              msUserSelect: 'none'
            }}
          />
        </div>
      </div>
      
      {/* Show tools only if showTools is true and onToolsRender is not provided */}
      {showTools && !onToolsRender && toolsComponent}
    </div>
  );
};

export default DrawingCanvas;
