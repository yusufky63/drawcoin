import React from "react";

interface ClearConfirmModalProps {
  show: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ClearConfirmModal: React.FC<ClearConfirmModalProps> = ({
  show,
  onConfirm,
  onCancel,
}) => {
  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[300] p-4">
      <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full">
        <h3 className="text-lg font-semibold mb-4 text-gray-800">
          Clear Canvas?
        </h3>
        <p className="text-gray-600 mb-6">
          Are you sure you want to clear everything? This action cannot be
          undone.
        </p>
        <div className="flex space-x-3">
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-colors"
          >
            Yes, Clear All
          </button>
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-medium transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

