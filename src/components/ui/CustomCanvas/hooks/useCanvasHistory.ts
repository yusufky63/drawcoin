import { useState } from "react";
import { DrawingElement } from "../types";

export const useCanvasHistory = () => {
  const [history, setHistory] = useState<DrawingElement[][]>([[]]);
  const [historyStep, setHistoryStep] = useState(0);

  const addToHistory = (elements: DrawingElement[]) => {
    const newHistory = history.slice(0, historyStep + 1);
    newHistory.push(elements);
    setHistory(newHistory);
    setHistoryStep(newHistory.length - 1);
  };

  const undo = (): DrawingElement[] => {
    if (historyStep > 0) {
      setHistoryStep(historyStep - 1);
      return history[historyStep - 1] || [];
    }
    return [];
  };

  const redo = (): DrawingElement[] | null => {
    if (historyStep < history.length - 1) {
      setHistoryStep(historyStep + 1);
      return history[historyStep + 1];
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

