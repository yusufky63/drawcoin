import React, { useRef, useEffect } from "react";
import { Point } from "../types";

interface TextInputOverlayProps {
  show: boolean;
  position: Point;
  value: string;
  fontSize: number;
  fontFamily: string;
  color: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  onFontSizeChange: (size: number) => void;
  onFontFamilyChange: (family: string) => void;
}

export const TextInputOverlay: React.FC<TextInputOverlayProps> = ({
  show,
  position,
  value,
  fontSize,
  fontFamily,
  color,
  onChange,
  onSubmit,
  onCancel,
  onFontSizeChange,
  onFontFamilyChange,
}) => {
  const textInputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (show && textInputRef.current) {
      textInputRef.current.focus();
      textInputRef.current.select();
    }
  }, [show]);

  if (!show) return null;

  return (
    <div
      className="absolute z-[110] pointer-events-auto"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <textarea
        ref={textInputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Type text... (Ctrl+Enter to submit)"
        className="px-2 py-1 border-2 border-blue-500 rounded bg-white focus:outline-none shadow-lg"
        style={{
          minWidth: "200px",
          minHeight: "60px",
          fontSize: `${fontSize}px`,
          fontFamily: fontFamily,
          color: color,
          lineHeight: "1.2",
          resize: "both",
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            onSubmit();
          } else if (e.key === "Escape") {
            e.preventDefault();
            onCancel();
          }
        }}
        rows={3}
      />
      <div className="mt-1 bg-white rounded px-2 py-2 shadow-lg border border-gray-200 space-y-2">
        <div className="flex items-center space-x-2">
          <span className="text-xs text-gray-600">Font:</span>
          <select
            value={fontFamily}
            onChange={(e) => onFontFamilyChange(e.target.value)}
            className="text-xs border border-gray-300 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
            style={{ fontFamily: fontFamily }}
          >
            <option value="Arial" style={{ fontFamily: "Arial" }}>
              Arial
            </option>
            <option value="Helvetica" style={{ fontFamily: "Helvetica" }}>
              Helvetica
            </option>
            <option
              value="Times New Roman"
              style={{ fontFamily: "Times New Roman" }}
            >
              Times New Roman
            </option>
            <option value="Courier New" style={{ fontFamily: "Courier New" }}>
              Courier New
            </option>
            <option value="Georgia" style={{ fontFamily: "Georgia" }}>
              Georgia
            </option>
            <option value="Verdana" style={{ fontFamily: "Verdana" }}>
              Verdana
            </option>
            <option
              value="Comic Sans MS"
              style={{ fontFamily: "Comic Sans MS" }}
            >
              Comic Sans MS
            </option>
            <option value="Impact" style={{ fontFamily: "Impact" }}>
              Impact
            </option>
            <option
              value="Trebuchet MS"
              style={{ fontFamily: "Trebuchet MS" }}
            >
              Trebuchet MS
            </option>
            <option value="Palatino" style={{ fontFamily: "Palatino" }}>
              Palatino
            </option>
          </select>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-xs text-gray-600">Size:</span>
          <input
            type="range"
            min="12"
            max="128"
            value={fontSize}
            onChange={(e) => onFontSizeChange(Number(e.target.value))}
            className="flex-1 h-1"
            style={{ accentColor: "#3b82f6" }}
          />
          <span className="text-xs text-gray-600 w-10">{fontSize}px</span>
        </div>
        <button
          onClick={onSubmit}
          className="w-full px-2 py-1 bg-blue-500 hover:bg-blue-600 text-white text-xs rounded transition-colors"
        >
          Add Text (Ctrl+Enter)
        </button>
      </div>
    </div>
  );
};

