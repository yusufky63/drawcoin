"use client";

import React, { useState, useEffect } from "react";

interface WelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function WelcomeModal({ isOpen, onClose }: WelcomeModalProps) {
  const [show, setShow] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setShow(true);
    } else {
      setTimeout(() => setShow(false), 300); // Wait for animation
    }
  }, [isOpen]);

  const handleClose = () => {
    if (dontShowAgain) {
      localStorage.setItem("welcome_modal_seen", "true");
    }
    onClose();
  };

  if (!show && !isOpen) return null;

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center p-4 transition-opacity duration-300 ${
        isOpen ? "opacity-100" : "opacity-0"
      }`}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      ></div>

      {/* Modal Content */}
      <div
        className={`relative w-full max-w-lg bg-[#fcfcfc] transition-all duration-300 transform ${
          isOpen ? "scale-100 rotate-1" : "scale-95 rotate-0"
        }`}
        style={{
          border: "4px solid #2d3748",
          borderRadius: "25px 5px 20px 15px",
          boxShadow: "8px 8px 0 #2d3748",
        }}
      >
        {/* Decorative elements */}
        <div className="absolute -top-3 -left-3 w-6 h-6 bg-[#E5E7EB] border-2 border-[#2d3748] rounded-full z-10 flex items-center justify-center shadow-[2px_2px_0_#2d3748]">
          <div className="w-2 h-2 bg-[#2d3748] rounded-full"></div>
        </div>
        <div className="absolute -top-3 -right-3 w-6 h-6 bg-[#E5E7EB] border-2 border-[#2d3748] rounded-full z-10 flex items-center justify-center shadow-[2px_2px_0_#2d3748]">
          <div className="w-2 h-2 bg-[#2d3748] rounded-full"></div>
        </div>

        <div className="p-6 md:p-8">
          {/* Header */}
          <div className="text-center mb-6">
            <h2
              className="text-3xl font-bold text-[#2d3748] mb-2 transform -rotate-1"
              style={{ textShadow: "1px 1px 0 rgba(0,0,0,0.1)" }}
            >
              Welcome to DrawCoin!
            </h2>
            <div className="mx-auto h-1 w-32 rotate-1 rounded-full bg-[var(--base-blue)]"></div>
          </div>

          {/* Steps */}
          <div className="space-y-6 mb-8">
            <div className="flex items-start space-x-4">
              <div className="flex h-10 w-10 flex-shrink-0 -rotate-2 items-center justify-center rounded-full border-2 border-[#2d3748] bg-[var(--base-blue)] text-xl font-bold text-white shadow-[3px_3px_0_#2d3748]">
                1
              </div>
              <div>
                <h3 className="text-lg font-bold text-[#2d3748]">Draw</h3>
                <p className="text-[#4a5568] text-sm md:text-base">
                  Create your unique token artwork using our hand-drawn canvas
                  tools.
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0 w-10 h-10 bg-[#48bb78] text-white rounded-full flex items-center justify-center text-xl font-bold border-2 border-[#2d3748] shadow-[3px_3px_0_#2d3748] transform rotate-1">
                2
              </div>
              <div>
                <h3 className="text-lg font-bold text-[#2d3748]">Tokenize</h3>
                <p className="text-[#4a5568] text-sm md:text-base">
                  Instantly deploy your art as a real token on the Base network.
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0 w-10 h-10 bg-[#ed8936] text-white rounded-full flex items-center justify-center text-xl font-bold border-2 border-[#2d3748] shadow-[3px_3px_0_#2d3748] transform -rotate-1">
                3
              </div>
              <div>
                <h3 className="text-lg font-bold text-[#2d3748]">Trade</h3>
                <p className="text-[#4a5568] text-sm md:text-base">
                  Buy, sell, and trade tokens with the community. Sponsored
                  transactions!
                </p>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="space-y-4">
            <button
              onClick={handleClose}
              className="w-full py-3 px-6 bg-[#2d3748] text-white text-lg font-bold rounded-xl transition-all hover:bg-[#1a202c] active:transform active:translate-y-1 transform hover:-rotate-1 shadow-[4px_4px_0_#CBD5E0]"
              style={{
                border: "2px solid #2d3748",
              }}
            >
              Let's Start Drawing! 🎨
            </button>

            <label className="flex items-center justify-center space-x-2 cursor-pointer text-[#718096] text-sm group">
              <div className="relative">
                <input
                  type="checkbox"
                  checked={dontShowAgain}
                  onChange={(e) => setDontShowAgain(e.target.checked)}
                  className="h-5 w-5 appearance-none rounded border-2 border-[#718096] transition-colors checked:border-[var(--base-blue)] checked:bg-[var(--base-blue)]"
                />
                {dontShowAgain && (
                  <svg
                    className="absolute top-0 left-0 w-5 h-5 text-white pointer-events-none p-0.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={3}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                )}
              </div>
              <span className="group-hover:text-[#4a5568] transition-colors">
                Don't show this again
              </span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
