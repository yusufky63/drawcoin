import React, { useState } from "react";
import { Tool, PenStyle } from "../types";
import { CANVAS_COLORS, PEN_TOOLS } from "../constants";

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
  onImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  historyStep: number;
  historyLength: number;
}

type MenuType = "colors" | "pen" | "shapes" | null;

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
  onImageUpload,
  historyStep,
  historyLength,
}) => {
  const [activeMenu, setActiveMenu] = useState<MenuType>(null);

  const toggleMenu = (menu: MenuType) => {
    setActiveMenu(activeMenu === menu ? null : menu);
  };

  const closeMenu = () => setActiveMenu(null);

  return (
    <>
      {/* Backdrop */}
      {activeMenu && (
        <div
          className="md:hidden fixed inset-0 bg-black/20 z-[80]"
          onClick={closeMenu}
        />
      )}

      {/* Toolbar - Canvas'ın hemen altında */}
      <div className="md:hidden relative z-[90] bg-white border-t border-gray-200 shadow-sm">
        {/* Expanded Menu - Positioned above toolbar */}
        {activeMenu && (
          <div className="absolute bottom-full left-0 right-0 border-t border-gray-200 bg-gray-50 shadow-md">
            {/* Colors Menu */}
            {activeMenu === "colors" && (
              <div className="p-4">
                <div className="grid grid-cols-8 gap-1 mb-3">
                  {CANVAS_COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => {
                        onColorChange(c);
                        closeMenu();
                      }}
                      className={`w-8 h-8 rounded-md transition-all ${
                        color === c
                          ? "ring-2 ring-blue-500 scale-110 shadow-lg"
                          : "ring-1 ring-gray-200"
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
                <input
                  type="color"
                  value={color}
                  onChange={(e) => onColorChange(e.target.value)}
                  className="w-full h-12 rounded-lg border-2 border-gray-200 cursor-pointer"
                />
              </div>
            )}

            {/* Pen Settings Menu */}
            {activeMenu === "pen" && (
              <div className="p-4 space-y-4">
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-2 block">
                    Pen Style
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {PEN_TOOLS.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => {
                          onToolChange("pen");
                          onPenStyleChange(t.id as PenStyle);
                        }}
                        className={`p-3 rounded-lg transition-all ${
                          penStyle === t.id
                            ? "bg-blue-500 text-white"
                            : "bg-white border border-gray-200"
                        }`}
                      >
                        <div className="text-2xl">{t.icon}</div>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-2 block">
                    Brush Size: {lineWidth}px
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="30"
                    value={lineWidth}
                    onChange={(e) => onLineWidthChange(Number(e.target.value))}
                    className="w-full h-2 rounded-lg appearance-none cursor-pointer"
                    style={{
                      background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${
                        ((lineWidth - 1) / 29) * 100
                      }%, #e5e7eb ${((lineWidth - 1) / 29) * 100}%, #e5e7eb 100%)`,
                    }}
                  />
                </div>
              </div>
            )}

            {/* Shapes Menu */}
            {activeMenu === "shapes" && (
              <div className="p-4">
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { id: "line", label: "Line", icon: "📏" },
                    { id: "rectangle", label: "Rectangle", icon: "▭" },
                    { id: "circle", label: "Circle", icon: "⭕" },
                    { id: "triangle", label: "Triangle", icon: "△" },
                    { id: "arrow", label: "Arrow", icon: "➡️" },
                    { id: "star", label: "Star", icon: "⭐" },
                  ].map((s) => (
                    <button
                      key={s.id}
                      onClick={() => {
                        onToolChange(s.id as Tool);
                        closeMenu();
                      }}
                      className={`p-3 rounded-xl flex flex-col items-center justify-center gap-1 transition-all ${
                        tool === s.id
                          ? "bg-blue-500 text-white shadow-md scale-105"
                          : "bg-white text-gray-700 border border-gray-200"
                      }`}
                    >
                      <span className="text-2xl">{s.icon}</span>
                      <span className="text-xs font-medium">{s.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Main Toolbar */}
        <div className="px-2 py-2">
          {/* Row 1: Main Drawing Tools */}
          <div className="flex items-center justify-center gap-1 mb-2">
            {/* Select Tool */}
            <button
              onClick={() => {
                onToolChange("select");
                closeMenu();
              }}
              className={`p-2 rounded-lg transition-all ${
                tool === "select" ? "bg-blue-500 text-white" : "hover:bg-gray-100"
              }`}
              title="Select"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2z" />
              </svg>
            </button>

            {/* Pen Tool */}
            <button
              onClick={() => {
                onToolChange("pen");
                closeMenu();
              }}
              className={`p-2 rounded-lg transition-all ${
                tool === "pen" ? "bg-blue-500 text-white" : "hover:bg-gray-100"
              }`}
              title="Pen"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>

            {/* Eraser Tool */}
            <button
              onClick={() => {
                onToolChange("eraser");
                closeMenu();
              }}
              className={`p-2 rounded-lg transition-all ${
                tool === "eraser" ? "bg-blue-500 text-white" : "hover:bg-gray-100"
              }`}
              title="Eraser"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 4L4 10l8 8 6-6-8-8z" />
              </svg>
            </button>

            {/* Text Tool */}
            <button
              onClick={() => {
                onToolChange("text");
                closeMenu();
              }}
              className={`p-2 px-3 rounded-lg transition-all ${
                tool === "text" ? "bg-blue-500 text-white" : "hover:bg-gray-100"
              }`}
              title="Text"
            >
              <div className="text-base font-bold">T</div>
            </button>

            {/* Pen Settings */}
            <button
              onClick={() => toggleMenu("pen")}
              className={`p-2 rounded-lg transition-all ${
                activeMenu === "pen" ? "bg-blue-500 text-white" : "hover:bg-gray-100"
              }`}
              title="Pen Style"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>

            {/* Color Picker */}
            <button
              onClick={() => toggleMenu("colors")}
              className={`p-1.5 rounded-lg transition-all ${
                activeMenu === "colors" ? "bg-blue-500 ring-2 ring-blue-300" : "ring-2 ring-gray-200"
              }`}
              style={{ backgroundColor: activeMenu === "colors" ? undefined : color }}
              title="Colors"
            >
              <div className="w-6 h-6"></div>
            </button>

            {/* Shapes */}
            <button
              onClick={() => toggleMenu("shapes")}
              className={`p-2 rounded-lg transition-all ${
                activeMenu === "shapes" ? "bg-blue-500 text-white" : "hover:bg-gray-100"
              }`}
              title="Shapes"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <rect x="3" y="3" width="18" height="18" strokeWidth={2} rx="2" />
              </svg>
            </button>

            {/* Fill Tool */}
            <button
              onClick={() => {
                onToolChange("fill");
                closeMenu();
              }}
              className={`p-2 rounded-lg transition-all ${
                tool === "fill" ? "bg-blue-500 text-white" : "hover:bg-gray-100"
              }`}
              title="Fill"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 008 10.586V5L7 4z" />
              </svg>
            </button>

            {/* Image Upload */}
            <label className="p-2 rounded-lg hover:bg-gray-100 cursor-pointer transition-all" title="Upload Image">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <input type="file" accept="image/*" onChange={onImageUpload} className="hidden" />
            </label>
          </div>

          {/* Row 2: History & Actions */}
          <div className="flex items-center justify-between gap-1">
            {/* Undo */}
            <button
              onClick={onUndo}
              disabled={historyStep <= 0}
              className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 transition-all flex-1"
              title="Undo"
            >
              <svg className="w-5 h-5 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
              </svg>
            </button>

            {/* Redo */}
            <button
              onClick={onRedo}
              disabled={historyStep >= historyLength - 1}
              className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 transition-all flex-1"
              title="Redo"
            >
              <svg className="w-5 h-5 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a8 8 0 00-8 8v2m18-10l-6 6m6-6l-6-6" />
              </svg>
            </button>

            {/* Clear */}
            <button
              onClick={onClear}
              className="p-2 rounded-lg hover:bg-red-50 hover:text-red-600 transition-all flex-1"
              title="Clear Canvas"
            >
              <svg className="w-5 h-5 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>

            {/* Download */}
            <button
              onClick={onDownload}
              className="p-2 rounded-lg hover:bg-green-50 hover:text-green-600 transition-all flex-1"
              title="Download"
            >
              <svg className="w-5 h-5 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

