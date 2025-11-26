import { useEffect } from "react";
import { Tool } from "../types";

interface UseKeyboardShortcutsProps {
  showTextInput: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onToolChange: (tool: Tool) => void;
  onDeselectElement: () => void;
  onCloseTextInput: () => void;
}

export const useKeyboardShortcuts = ({
  showTextInput,
  onUndo,
  onRedo,
  onToolChange,
  onDeselectElement,
  onCloseTextInput,
}: UseKeyboardShortcutsProps) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in input or textarea
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      // Undo/Redo
      if (e.ctrlKey || e.metaKey) {
        if (e.key === "z" && !e.shiftKey) {
          e.preventDefault();
          onUndo();
        } else if (e.key === "y" || (e.key === "z" && e.shiftKey)) {
          e.preventDefault();
          onRedo();
        }
        return;
      }

        // Tool shortcuts (only if not in text input mode)
        if (!showTextInput) {
          switch (e.key.toLowerCase()) {
            case "v":
              onToolChange("select");
              onDeselectElement(); // Clear any existing selection
              break;
            case "p":
              onToolChange("pen");
              onDeselectElement();
              break;
            case "e":
              onToolChange("eraser");
              onDeselectElement();
              break;
            case "r":
              onToolChange("rectangle");
              onDeselectElement();
              break;
            case "c":
              onToolChange("circle");
              onDeselectElement();
              break;
            case "t":
              onToolChange("text");
              onDeselectElement();
              break;
            case "f":
              onToolChange("fill");
              onDeselectElement();
              break;
            case "l":
              onToolChange("line");
              onDeselectElement();
              break;
            case "escape":
              onDeselectElement();
              onCloseTextInput();
              break;
            case "delete":
            case "backspace":
              // Will handle delete in index.tsx
              break;
          }
        }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showTextInput, onUndo, onRedo, onToolChange, onDeselectElement, onCloseTextInput]);
};

