import React, { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Circle,
  Download,
  Eraser,
  Minus,
  MoreHorizontal,
  MousePointer2,
  PaintBucket,
  PenLine,
  Redo2,
  Shapes,
  Square,
  Star,
  Trash2,
  Triangle,
  Type,
  Undo2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { PenStyle, Tool } from "../types";
import { QUICK_CANVAS_COLORS } from "../constants";
import { ERASER_COLOR, getEraserStrokeWidth } from "../utils/eraserUtils";

interface DesktopToolbarProps {
  tool: Tool;
  historyStep: number;
  historyLength: number;
  onToolChange: (tool: Tool) => void;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  onDownload: () => void;
}

interface DesktopInspectorProps {
  tool: Tool;
  color: string;
  customColor: string;
  lineWidth: number;
  penStyle: PenStyle;
  onToolChange: (tool: Tool) => void;
  onColorChange: (color: string) => void;
  onCustomColorChange: (color: string) => void;
  onLineWidthChange: (width: number) => void;
  onPenStyleChange: (style: PenStyle) => void;
}

interface IconButtonProps {
  label: string;
  icon: LucideIcon;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}

const SHAPE_TOOLS: Tool[] = [
  "line",
  "rectangle",
  "circle",
  "triangle",
  "arrow",
  "star",
];

const SHAPE_OPTIONS: Array<{
  id: Tool;
  label: string;
  icon: LucideIcon;
}> = [
  { id: "line", label: "Line", icon: Minus },
  { id: "rectangle", label: "Rectangle", icon: Square },
  { id: "circle", label: "Circle", icon: Circle },
  { id: "triangle", label: "Triangle", icon: Triangle },
  { id: "arrow", label: "Arrow", icon: ArrowRight },
  { id: "star", label: "Star", icon: Star },
];

const PEN_STYLES: Array<{ id: PenStyle; label: string }> = [
  { id: "pen", label: "Pen" },
  { id: "brush", label: "Brush" },
  { id: "marker", label: "Marker" },
  { id: "highlighter", label: "Highlight" },
];

function isShapeTool(tool: Tool) {
  return SHAPE_TOOLS.includes(tool);
}

function IconButton({
  label,
  icon: Icon,
  active = false,
  disabled = false,
  onClick,
}: IconButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0052ff] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-30 ${
        active
          ? "border-[#0052ff] bg-[#0052ff] text-white"
          : "border-transparent text-gray-700 hover:border-gray-200 hover:bg-gray-50"
      }`}
      aria-label={label}
      aria-pressed={active}
      title={label}
    >
      <Icon aria-hidden="true" className="h-[18px] w-[18px]" />
    </button>
  );
}

export const DesktopToolbar: React.FC<DesktopToolbarProps> = ({
  tool,
  historyStep,
  historyLength,
  onToolChange,
  onUndo,
  onRedo,
  onClear,
  onDownload,
}) => {
  const [actionsOpen, setActionsOpen] = useState(false);
  const actionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!actionsOpen) return;

    const closeOnPointerDown = (event: PointerEvent) => {
      if (!actionsRef.current?.contains(event.target as Node)) {
        setActionsOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setActionsOpen(false);
    };

    document.addEventListener("pointerdown", closeOnPointerDown);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnPointerDown);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [actionsOpen]);

  return (
    <div
      className="relative z-20 hidden min-h-12 w-full items-center justify-between gap-2 rounded-xl border-2 border-[#2d3748] bg-white p-1.5 shadow-[2px_2px_0_#171717] lg:flex"
      role="toolbar"
      aria-label="Drawing tools"
    >
      <div className="flex min-w-0 items-center gap-0.5">
        <IconButton
          label="Select"
          icon={MousePointer2}
          active={tool === "select"}
          onClick={() => onToolChange("select")}
        />
        <IconButton
          label="Pen"
          icon={PenLine}
          active={tool === "pen"}
          onClick={() => onToolChange("pen")}
        />
        <IconButton
          label="Eraser"
          icon={Eraser}
          active={tool === "eraser"}
          onClick={() => onToolChange("eraser")}
        />
        <IconButton
          label="Fill"
          icon={PaintBucket}
          active={tool === "fill"}
          onClick={() => onToolChange("fill")}
        />
        <IconButton
          label="Shapes"
          icon={Shapes}
          active={isShapeTool(tool)}
          onClick={() => onToolChange(isShapeTool(tool) ? tool : "rectangle")}
        />
        <IconButton
          label="Text"
          icon={Type}
          active={tool === "text"}
          onClick={() => onToolChange("text")}
        />
      </div>

      <div className="flex shrink-0 items-center gap-0.5 border-l border-gray-200 pl-1.5">
        <IconButton
          label="Undo"
          icon={Undo2}
          disabled={historyStep <= 0}
          onClick={onUndo}
        />
        <IconButton
          label="Redo"
          icon={Redo2}
          disabled={historyStep >= historyLength - 1}
          onClick={onRedo}
        />
        <div ref={actionsRef} className="relative">
          <button
            type="button"
            onClick={() => setActionsOpen((open) => !open)}
            className={`inline-flex h-11 w-11 items-center justify-center rounded-lg border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0052ff] focus-visible:ring-offset-2 ${
              actionsOpen
                ? "border-[#0052ff] bg-[#eef3ff] text-[#003ecb]"
                : "border-transparent text-gray-700 hover:border-gray-200 hover:bg-gray-50"
            }`}
            aria-label="More canvas actions"
            aria-expanded={actionsOpen}
          >
            <MoreHorizontal aria-hidden="true" className="h-5 w-5" />
          </button>
          {actionsOpen ? (
            <div
              className="absolute right-0 top-[calc(100%+0.5rem)] z-30 w-44 rounded-xl border-2 border-[#2d3748] bg-white p-1.5 shadow-[3px_3px_0_#171717]"
              role="menu"
            >
              <button
                type="button"
                onClick={() => {
                  onDownload();
                  setActionsOpen(false);
                }}
                className="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-left text-xs font-semibold text-gray-800 hover:bg-gray-50"
                role="menuitem"
              >
                <Download aria-hidden="true" className="h-4 w-4" />
                Save PNG
              </button>
              <button
                type="button"
                onClick={() => {
                  onClear();
                  setActionsOpen(false);
                }}
                className="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-left text-xs font-semibold text-red-600 hover:bg-red-50"
                role="menuitem"
              >
                <Trash2 aria-hidden="true" className="h-4 w-4" />
                Clear canvas
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export const DesktopInspector: React.FC<DesktopInspectorProps> = ({
  tool,
  color,
  customColor,
  lineWidth,
  penStyle,
  onToolChange,
  onColorChange,
  onCustomColorChange,
  onLineWidthChange,
  onPenStyleChange,
}) => {
  const title = isShapeTool(tool)
    ? "Shape"
    : tool === "eraser"
      ? "Eraser"
      : tool === "fill"
        ? "Fill"
        : tool === "text"
          ? "Text"
          : tool === "select"
            ? "Select"
            : "Pen";
  const showsColor = tool !== "select" && tool !== "eraser";
  const showsSize = tool === "pen" || tool === "eraser";

  return (
    <aside className="sticky top-28 hidden w-60 shrink-0 rounded-xl border-2 border-[#2d3748] bg-white p-3 shadow-[2px_2px_0_#171717] lg:block">
      <div className="mb-3 flex items-center justify-between border-b border-gray-200 pb-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#0052ff]">
            Tool settings
          </p>
          <h3 className="text-base font-bold text-gray-900">{title}</h3>
        </div>
        <span
          className="h-5 w-5 rounded-full border border-gray-300"
          style={{ backgroundColor: tool === "eraser" ? ERASER_COLOR : color }}
          aria-hidden="true"
        />
      </div>

      {tool === "select" ? (
        <p className="rounded-lg bg-gray-50 p-2.5 text-xs leading-5 text-gray-600">
          Tap an element to move or resize it.
        </p>
      ) : null}

      {tool === "pen" ? (
        <div className="mb-3">
          <p className="mb-1.5 text-[11px] font-semibold text-gray-600">
            Style
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            {PEN_STYLES.map((style) => (
              <button
                type="button"
                key={style.id}
                onClick={() => onPenStyleChange(style.id)}
                className={`min-h-9 rounded-lg border px-2 text-[11px] font-semibold transition-colors ${
                  penStyle === style.id
                    ? "border-[#0052ff] bg-[#eef3ff] text-[#003ecb]"
                    : "border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
                aria-pressed={penStyle === style.id}
              >
                {style.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {showsSize ? (
        <div className="mb-3">
          <div className="mb-1 flex items-center justify-between text-[11px] font-semibold text-gray-600">
            <label htmlFor="desktop-canvas-size">
              {tool === "eraser" ? "Eraser size" : "Brush size"}
            </label>
            <span className="text-[#0052ff]">
              {tool === "eraser" ? getEraserStrokeWidth(lineWidth) : lineWidth}px
            </span>
          </div>
          <input
            id="desktop-canvas-size"
            type="range"
            min="1"
            max="30"
            value={lineWidth}
            onChange={(event) => onLineWidthChange(Number(event.target.value))}
            className="h-8 w-full"
            style={{ accentColor: "#0052ff" }}
          />
        </div>
      ) : null}

      {isShapeTool(tool) ? (
        <div className="mb-3">
          <p className="mb-1.5 text-[11px] font-semibold text-gray-600">
            Shape
          </p>
          <div className="grid grid-cols-3 gap-1.5">
            {SHAPE_OPTIONS.map(({ id, label, icon: Icon }) => (
              <button
                type="button"
                key={id}
                onClick={() => onToolChange(id)}
                className={`flex h-10 items-center justify-center rounded-lg border transition-colors ${
                  tool === id
                    ? "border-[#0052ff] bg-[#0052ff] text-white"
                    : "border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
                aria-label={label}
                aria-pressed={tool === id}
                title={label}
              >
                <Icon aria-hidden="true" className="h-4 w-4" />
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {tool === "text" ? (
        <p className="mb-3 rounded-lg bg-gray-50 p-2.5 text-xs leading-5 text-gray-600">
          Tap the canvas where you want to add text.
        </p>
      ) : null}

      {tool === "fill" ? (
        <p className="mb-3 rounded-lg bg-blue-50 p-2.5 text-xs leading-5 text-blue-800">
          Choose a color, then tap a shape or the empty canvas.
        </p>
      ) : null}

      {showsColor ? (
        <div>
          <p className="mb-1.5 text-[11px] font-semibold text-gray-600">
            Color
          </p>
          <div className="grid grid-cols-4 justify-items-center gap-1">
            {QUICK_CANVAS_COLORS.map((canvasColor) => (
              <button
                type="button"
                key={canvasColor}
                onClick={() => {
                  onColorChange(canvasColor);
                  onCustomColorChange(canvasColor);
                }}
                className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${
                  color === canvasColor ? "bg-[#eef3ff]" : "hover:bg-gray-50"
                }`}
                aria-label={`Use color ${canvasColor}`}
                aria-pressed={color === canvasColor}
              >
                <span
                  className={`h-5 w-5 rounded-full border ${
                    color === canvasColor
                      ? "border-[#0052ff] ring-2 ring-blue-200"
                      : "border-gray-300"
                  }`}
                  style={{ backgroundColor: canvasColor }}
                  aria-hidden="true"
                />
              </button>
            ))}
          </div>
          <label className="mt-2 flex min-h-10 items-center justify-between rounded-lg border border-gray-200 px-2.5 text-[11px] font-semibold text-gray-600">
            Custom color
            <input
              type="color"
              value={customColor}
              onChange={(event) => {
                onCustomColorChange(event.target.value);
                onColorChange(event.target.value);
              }}
              className="h-7 w-9 cursor-pointer rounded border-0 bg-transparent p-0"
              aria-label="Choose a custom canvas color"
            />
          </label>
        </div>
      ) : null}
    </aside>
  );
};
