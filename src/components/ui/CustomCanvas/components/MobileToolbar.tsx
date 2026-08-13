import React, { useState } from "react";
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
  Settings2,
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

interface MobileToolbarProps {
  tool: Tool;
  color: string;
  lineWidth: number;
  penStyle: PenStyle;
  onToolChange: (tool: Tool) => void;
  onColorChange: (color: string) => void;
  onLineWidthChange: (width: number) => void;
  onPenStyleChange: (style: PenStyle) => void;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  onDownload: () => void;
  historyStep: number;
  historyLength: number;
}

type MenuType = "colors" | "pen" | "eraser" | "shapes" | "more" | null;

const PEN_STYLES: Array<{ id: PenStyle; label: string }> = [
  { id: "pen", label: "Pen" },
  { id: "brush", label: "Brush" },
  { id: "marker", label: "Marker" },
  { id: "highlighter", label: "Highlight" },
];

const SHAPES: Array<{ id: Tool; label: string; icon: LucideIcon }> = [
  { id: "line", label: "Line", icon: Minus },
  { id: "rectangle", label: "Rectangle", icon: Square },
  { id: "circle", label: "Circle", icon: Circle },
  { id: "triangle", label: "Triangle", icon: Triangle },
  { id: "arrow", label: "Arrow", icon: ArrowRight },
  { id: "star", label: "Star", icon: Star },
];

interface DockButtonProps {
  label: string;
  icon: LucideIcon;
  swatchColor?: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}

function DockButton({
  label,
  icon: Icon,
  swatchColor,
  active = false,
  disabled = false,
  onClick,
}: DockButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex min-h-12 min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg px-1 text-[10px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0052ff] focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-30 ${
        active
          ? "bg-[#0052ff] text-white"
          : "text-gray-700 hover:bg-gray-50"
      }`}
      aria-label={label}
      aria-pressed={active}
    >
      {swatchColor ? (
        <span
          className="h-[18px] w-[18px] rounded-full border border-gray-300"
          style={{ backgroundColor: swatchColor }}
          aria-hidden="true"
        />
      ) : (
        <Icon aria-hidden="true" className="h-[18px] w-[18px]" />
      )}
      <span>{label}</span>
    </button>
  );
}

interface MenuActionProps {
  label: string;
  icon: LucideIcon;
  active?: boolean;
  disabled?: boolean;
  danger?: boolean;
  onClick: () => void;
}

function MenuAction({
  label,
  icon: Icon,
  active = false,
  disabled = false,
  danger = false,
  onClick,
}: MenuActionProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex min-h-12 items-center gap-2 rounded-lg border px-2 text-left text-[11px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-30 ${
        active
          ? "border-[#0052ff] bg-[#eef3ff] text-[#003ecb]"
          : danger
            ? "border-red-100 text-red-600 hover:bg-red-50"
            : "border-gray-200 text-gray-700 hover:bg-gray-50"
      }`}
      aria-pressed={active}
    >
      <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
      <span>{label}</span>
    </button>
  );
}

export const MobileToolbar: React.FC<MobileToolbarProps> = ({
  tool,
  color,
  lineWidth,
  penStyle,
  onToolChange,
  onColorChange,
  onLineWidthChange,
  onPenStyleChange,
  onUndo,
  onRedo,
  onClear,
  onDownload,
  historyStep,
  historyLength,
}) => {
  const [activeMenu, setActiveMenu] = useState<MenuType>(null);

  const toggleMenu = (menu: Exclude<MenuType, null>) => {
    setActiveMenu((current) => (current === menu ? null : menu));
  };
  const closeMenu = () => setActiveMenu(null);

  return (
    <div className="relative z-[90] mt-2 rounded-xl border-2 border-[#2d3748] bg-white shadow-[2px_2px_0_#171717] lg:hidden">
      {activeMenu ? (
        <button
          type="button"
          className="fixed inset-0 z-[80] touch-pan-y bg-black/20 lg:hidden"
          onClick={closeMenu}
          aria-label="Close drawing settings"
        />
      ) : null}

      {activeMenu ? (
        <section
          id="canvas-mobile-toolbar-menu"
          className="absolute bottom-[calc(100%+0.5rem)] left-0 right-0 z-[90] max-h-[min(42dvh,17rem)] overflow-y-auto rounded-xl border-2 border-[#2d3748] bg-white p-2 shadow-[3px_3px_0_#171717]"
          aria-label={`${activeMenu} drawing settings`}
        >
          {activeMenu === "colors" ? (
            <div>
              <div className="grid grid-cols-4 justify-items-center gap-1">
                {QUICK_CANVAS_COLORS.map((canvasColor) => (
                  <button
                    type="button"
                    key={canvasColor}
                    onClick={() => {
                      onColorChange(canvasColor);
                      closeMenu();
                    }}
                    className={`flex h-11 w-11 items-center justify-center rounded-lg ${
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
              <label className="mt-1.5 flex min-h-11 items-center justify-between rounded-lg border border-gray-200 px-3 text-xs font-semibold text-gray-600">
                Custom color
                <input
                  type="color"
                  value={color}
                  onChange={(event) => onColorChange(event.target.value)}
                  className="h-8 w-10 cursor-pointer rounded border-0 bg-transparent p-0"
                  aria-label="Choose a custom canvas color"
                />
              </label>
            </div>
          ) : null}

          {activeMenu === "pen" ? (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-1.5">
                {PEN_STYLES.map((style) => (
                  <button
                    type="button"
                    key={style.id}
                    onClick={() => {
                      onToolChange("pen");
                      onPenStyleChange(style.id);
                    }}
                    className={`min-h-10 rounded-lg border px-2 text-xs font-semibold ${
                      penStyle === style.id
                        ? "border-[#0052ff] bg-[#eef3ff] text-[#003ecb]"
                        : "border-gray-200 text-gray-600"
                    }`}
                    aria-pressed={tool === "pen" && penStyle === style.id}
                  >
                    {style.label}
                  </button>
                ))}
              </div>
              <label className="block text-[11px] font-semibold text-gray-600">
                Brush size · {lineWidth}px
                <input
                  type="range"
                  min="1"
                  max="30"
                  value={lineWidth}
                  onChange={(event) =>
                    onLineWidthChange(Number(event.target.value))
                  }
                  className="mt-1 h-8 w-full"
                  style={{ accentColor: "#0052ff" }}
                />
              </label>
            </div>
          ) : null}

          {activeMenu === "eraser" ? (
            <label className="block text-[11px] font-semibold text-gray-600">
              Eraser size · {getEraserStrokeWidth(lineWidth)}px
              <input
                type="range"
                min="1"
                max="30"
                value={lineWidth}
                onChange={(event) =>
                  onLineWidthChange(Number(event.target.value))
                }
                className="mt-1 h-8 w-full"
                style={{ accentColor: "#0052ff" }}
              />
            </label>
          ) : null}

          {activeMenu === "shapes" ? (
            <div className="grid grid-cols-3 gap-1.5">
              {SHAPES.map(({ id, label, icon: Icon }) => (
                <button
                  type="button"
                  key={id}
                  onClick={() => {
                    onToolChange(id);
                    closeMenu();
                  }}
                  className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-lg border text-[10px] font-semibold ${
                    tool === id
                      ? "border-[#0052ff] bg-[#0052ff] text-white"
                      : "border-gray-200 text-gray-600"
                  }`}
                  aria-pressed={tool === id}
                >
                  <Icon aria-hidden="true" className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </div>
          ) : null}

          {activeMenu === "more" ? (
            <div className="grid grid-cols-3 gap-1.5">
              <MenuAction
                label="Select"
                icon={MousePointer2}
                active={tool === "select"}
                onClick={() => {
                  onToolChange("select");
                  closeMenu();
                }}
              />
              <MenuAction
                label="Brush"
                icon={Settings2}
                onClick={() => setActiveMenu("pen")}
              />
              <MenuAction
                label="Fill"
                icon={PaintBucket}
                active={tool === "fill"}
                onClick={() => {
                  onToolChange("fill");
                  closeMenu();
                }}
              />
              <MenuAction
                label="Shapes"
                icon={Shapes}
                onClick={() => setActiveMenu("shapes")}
              />
              <MenuAction
                label="Text"
                icon={Type}
                active={tool === "text"}
                onClick={() => {
                  onToolChange("text");
                  closeMenu();
                }}
              />
              <MenuAction
                label="Redo"
                icon={Redo2}
                disabled={historyStep >= historyLength - 1}
                onClick={() => {
                  onRedo();
                  closeMenu();
                }}
              />
              <MenuAction
                label="Save"
                icon={Download}
                onClick={() => {
                  onDownload();
                  closeMenu();
                }}
              />
              <MenuAction
                label="Clear"
                icon={Trash2}
                danger
                onClick={() => {
                  onClear();
                  closeMenu();
                }}
              />
            </div>
          ) : null}
        </section>
      ) : null}

      <div
        className="relative z-[95] grid grid-cols-5 gap-1 p-1.5"
        role="toolbar"
        aria-label="Essential canvas tools"
      >
        <DockButton
          label="Pen"
          icon={PenLine}
          active={tool === "pen"}
          onClick={() => {
            if (tool === "pen") toggleMenu("pen");
            else {
              onToolChange("pen");
              closeMenu();
            }
          }}
        />
        <DockButton
          label="Erase"
          icon={Eraser}
          active={tool === "eraser"}
          onClick={() => {
            if (tool === "eraser") toggleMenu("eraser");
            else {
              onToolChange("eraser");
              closeMenu();
            }
          }}
        />
        <DockButton
          label="Color"
          icon={Circle}
          swatchColor={tool === "eraser" ? ERASER_COLOR : color}
          active={activeMenu === "colors"}
          disabled={tool === "eraser"}
          onClick={() => toggleMenu("colors")}
        />
        <DockButton
          label="Undo"
          icon={Undo2}
          disabled={historyStep <= 0}
          onClick={() => {
            onUndo();
            closeMenu();
          }}
        />
        <DockButton
          label="More"
          icon={MoreHorizontal}
          active={activeMenu === "more"}
          onClick={() => toggleMenu("more")}
        />
      </div>

    </div>
  );
};
