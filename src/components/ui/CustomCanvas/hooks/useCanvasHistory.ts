import { useState } from "react";
import { DrawingElement } from "../types";
import { cloneDrawingElements } from "../utils/draftUtils";

export const useCanvasHistory = (initialElements: DrawingElement[] = []) => {
  const [history, setHistory] = useState<DrawingElement[][]>(() => [
    cloneDrawingElements(initialElements),
  ]);
  const [historyStep, setHistoryStep] = useState(0);

  const addToHistory = (elements: DrawingElement[]) => {
    const newHistory = history.slice(0, historyStep + 1);
    newHistory.push(cloneDrawingElements(elements));
    setHistory(newHistory);
    setHistoryStep(newHistory.length - 1);
  };

  const undo = (): DrawingElement[] => {
    if (historyStep > 0) {
      setHistoryStep(historyStep - 1);
      return cloneDrawingElements(history[historyStep - 1] || []);
    }
    return [];
  };

  const redo = (): DrawingElement[] | null => {
    if (historyStep < history.length - 1) {
      setHistoryStep(historyStep + 1);
      return cloneDrawingElements(history[historyStep + 1]);
    }
    return null;
  };

  const clearHistory = () => {
    setHistory([[]]);
    setHistoryStep(0);
  };

  return {
    history,
    historyStep,
    addToHistory,
    undo,
    redo,
    clearHistory,
  };
};

