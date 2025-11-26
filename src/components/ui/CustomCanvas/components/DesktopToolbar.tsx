import React from "react";
import { Tool, PenStyle } from "../types";
import { CANVAS_COLORS, PEN_TOOLS } from "../constants";

interface DesktopToolbarProps {
  tool: Tool;
  color: string;
  customColor: string;
  lineWidth: number;
  penStyle: PenStyle;
  fontSize: number;
  fontFamily: string;
  historyStep: number;
  historyLength: number;
  onToolChange: (tool: Tool) => void;
  onColorChange: (color: string) => void;
  onCustomColorChange: (color: string) => void;
  onLineWidthChange: (width: number) => void;
  onPenStyleChange: (style: PenStyle) => void;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  onDownload: () => void;
  onImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const DesktopToolbar: React.FC<DesktopToolbarProps> = ({
  tool,
  color,
  customColor,
  lineWidth,
  penStyle,
  historyStep,
  historyLength,
  onToolChange,
  onColorChange,
  onCustomColorChange,
  onLineWidthChange,
  onPenStyleChange,
  onUndo,
  onRedo,
  onClear,
  onDownload,
  onImageUpload,
}) => {
  return (
    <div className="hidden md:block relative z-10">
      <div className="hand-drawn-card p-3 space-y-2 overflow-y-auto">
        {/* Actions */}
        <div>
          <h3 className="text-xs font-bold mb-1.5 text-gray-700">Actions</h3>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={onUndo}
              disabled={historyStep <= 0}
              className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-30 flex flex-col items-center text-xs"
              title="Undo"
            >
              <svg className="w-5 h-5 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
              </svg>
              Undo
            </button>
            <button
              onClick={onRedo}
              disabled={historyStep >= historyLength - 1}
              className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-30 flex flex-col items-center text-xs"
              title="Redo"
            >
              <svg className="w-5 h-5 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a8 8 0 00-8 8v2m18-10l-6 6m6-6l-6-6" />
              </svg>
              Redo
            </button>
            <button
              onClick={onClear}
              className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors flex flex-col items-center text-xs"
              title="Clear All"
            >
              <svg className="w-5 h-5 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Clear
            </button>
            <button
              onClick={onDownload}
              className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors flex flex-col items-center text-xs"
              title="Download"
            >
              <svg className="w-5 h-5 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Save
            </button>
          </div>
        </div>

        <div className="border-t border-gray-200"></div>

        {/* Tools */}
        <div>
          <h3 className="text-xs font-bold mb-1.5 text-gray-700">Tools</h3>
          <div className="grid grid-cols-2 gap-2">
            {[
              { id: "select", label: "Select", icon: "M15 15l-2 5L9 9l11 4-5 2z" },
              { id: "pen", label: "Pen", icon: "M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" },
              { id: "eraser", label: "Erase", icon: "M10 4L4 10l8 8 6-6-8-8z" },
              { id: "fill", label: "Fill", icon: "M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 008 10.586V5L7 4z" },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  onToolChange(t.id as Tool);
                }}
                className={`p-1.5 rounded-lg transition-colors flex flex-col items-center text-xs ${
                  tool === t.id ? "bg-blue-500 text-white" : "hover:bg-gray-100"
                }`}
                title={t.label}
              >
                <svg className="w-5 h-5 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={t.icon} />
                </svg>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="border-t border-gray-200"></div>

        {/* Pen Styles */}
        <div>
          <h3 className="text-xs font-bold mb-1.5 text-gray-700">Pen Style</h3>
          <div className="grid grid-cols-2 gap-2">
            {PEN_TOOLS.map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  onToolChange("pen");
                  onPenStyleChange(t.id as PenStyle);
                }}
                className={`p-2 rounded transition-colors flex items-center justify-center text-lg ${
                  tool === "pen" && penStyle === t.id ? "bg-blue-500" : "bg-gray-100 hover:bg-gray-200"
                }`}
                title={t.label}
              >
                {t.icon}
              </button>
            ))}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <input
              type="range"
              min="1"
              max="30"
              value={lineWidth}
              onChange={(e) => onLineWidthChange(Number(e.target.value))}
              className="w-full mb-1"
              style={{ accentColor: "#3b82f6" }}
            />
            <div className="text-center text-xs font-bold text-blue-600">{lineWidth}px</div>
          </div>
        </div>

        <div className="border-t border-gray-200"></div>

        {/* Shapes */}
        <div>
          <h3 className="text-xs font-bold mb-1.5 text-gray-700">Shapes</h3>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: "line", icon: "M5 19l14-14" },
              { id: "rectangle", icon: "rect", props: { x: "3", y: "3", width: "18", height: "18", rx: "2" } },
              { id: "circle", icon: "circle", props: { cx: "12", cy: "12", r: "9" } },
              { id: "triangle", icon: "M12 3l9 18H3l9-18z" },
              { id: "arrow", icon: "M13 7l5 5m0 0l-5 5m5-5H6" },
              { id: "star", icon: "M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" },
            ].map((s) => (
              <button
                key={s.id}
                onClick={() => onToolChange(s.id as Tool)}
                className={`p-2 rounded transition-colors ${
                  tool === s.id ? "bg-blue-500 text-white" : "bg-gray-100 hover:bg-gray-200"
                }`}
                title={s.id}
              >
                <svg className="w-5 h-5 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {s.icon === "rect" ? (
                    <rect {...s.props} strokeWidth={2} />
                  ) : s.icon === "circle" ? (
                    <circle {...s.props} strokeWidth={2} />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={s.icon} />
                  )}
                </svg>
              </button>
            ))}
          </div>
        </div>

        <div className="border-t border-gray-200"></div>

        {/* Text & Image */}
        <div>
          <h3 className="text-xs font-bold mb-1.5 text-gray-700">Other</h3>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => onToolChange("text")}
              className={`p-2 rounded-lg transition-colors flex flex-col items-center ${
                tool === "text" ? "bg-blue-500 text-white" : "hover:bg-gray-100"
              }`}
              title="Text"
            >
              <div className="text-xl font-bold">T</div>
              <span className="text-xs">Text</span>
            </button>
            <label className="p-2 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer flex flex-col items-center text-xs" title="Image">
              <svg className="w-5 h-5 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Image
              <input type="file" accept="image/*" onChange={onImageUpload} className="hidden" />
            </label>
          </div>
        </div>

        <div className="border-t border-gray-200"></div>

        {/* Color */}
        <div>
          <h3 className="text-xs font-bold mb-1.5 text-gray-700">Color</h3>
          <div className="grid grid-cols-5 gap-1 mb-2">
            {CANVAS_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => {
                  onColorChange(c);
                  onCustomColorChange(c);
                }}
                className={`w-6 h-6 rounded border-2 transition-all hover:scale-110 ${
                  color === c ? "border-blue-500 scale-110 shadow-md" : "border-gray-200"
                }`}
                style={{ backgroundColor: c }}
                title={c}
              />
            ))}
          </div>
          <div className="flex items-center gap-2 mt-2">
            <label className="text-xs font-medium text-gray-600">Custom:</label>
            <input
              type="color"
              value={customColor}
              onChange={(e) => {
                onCustomColorChange(e.target.value);
                onColorChange(e.target.value);
              }}
              className="w-full h-8 rounded border-2 border-gray-300 cursor-pointer"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

