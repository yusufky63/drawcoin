import React, { useState, useEffect } from "react";
import {
  useAccount,
  useWalletClient,
  usePublicClient,
  useSwitchChain,
} from "wagmi";
import { createToken } from "../../lib/functions/createToken";
import {
  showCreateMessages,
  showIPFSMessages,
  showAIMessages,
  showError,
} from "../../utils/toastUtils";
import CustomCanvas, { CustomCanvasRef } from "../ui/CustomCanvas";
import HandDrawnIcon from "../ui/HandDrawnIcon";
import SuccessModal from "./SuccessModal";
import { toast } from "react-hot-toast";
import HandDrawnSkeleton from "../ui/HandDrawnSkeleton";

interface CreatePageProps {
  onSuccess?: (tokenAddress: string) => void;
}

export default function CreatePage({ onSuccess }: CreatePageProps) {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const { switchChain } = useSwitchChain();
  const customCanvasRef = React.useRef<CustomCanvasRef>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    symbol: "",
    description: "",
    imageUrl: "",
  });

  // Note: Initial purchase is no longer supported in SDK v2
  // Users will need to purchase tokens separately after creation
  const [ownersAddresses, setOwnersAddresses] = useState<string[]>([]);
  const [ownerInputValue, setOwnerInputValue] = useState<string>("");
  const [selectedCurrency] = useState<number>(0); // ZORA currency
  const [startingMarketCap, setStartingMarketCap] = useState<number>(0); // LOW = 0, HIGH = 1
  const [smartWalletRouting] = useState<number>(0); // AUTO = 0, DISABLE = 1 (default AUTO)
  const [showAdvancedOptions, setShowAdvancedOptions] =
    useState<boolean>(false);
  const [platformReferrer] = useState<string>(
    "0xbFA6A45Dd534d39dF47A3F3D2f2b6E88416f9831"
  );

  // UI state
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [drawnImage, setDrawnImage] = useState<string>("");
  const [currentStep, setCurrentStep] = useState(1);
  const [canvasSize, setCanvasSize] = useState({ width: 1024, height: 1024 });
  const totalSteps = 3;

  // Success modal state
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [createdTokenAddress, setCreatedTokenAddress] = useState<string>("");

  // Retry state
  const [retryCount, setRetryCount] = useState(0);
  const [maxRetries] = useState(3);

  // AI Draw state
  const [drawMode, setDrawMode] = useState<"custom" | "ai">("custom");
  const [aiPrompt, setAiPrompt] = useState<string>("");
  const [aiGenerating, setAiGenerating] = useState<boolean>(false);
  const [aiGeneratedImage, setAiGeneratedImage] = useState<string>("");

  // AI Limit state
  const [aiLimit, setAiLimit] = useState<{
    usage: number;
    limit: number;
    resetTime?: string;
  }>({
    usage: 0,
    limit: 3, // ✅ Daily limit is 3
    resetTime: undefined,
  });

  // Calculate remaining time until reset
  const getRemainingTime = () => {
    if (!aiLimit.resetTime) return null;
    const now = new Date();
    const reset = new Date(aiLimit.resetTime);
    const diff = reset.getTime() - now.getTime();

    if (diff <= 0) return "Soon";

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const isAiLimitReached = aiLimit.usage >= aiLimit.limit;

  useEffect(() => {
    setInitialLoading(false);
  }, []);

  useEffect(() => {
    setInitialLoading(false);
  }, []);

  useEffect(() => {
    const fetchAiLimit = async () => {
      if (address) {
        try {
          const { supabase } = await import("../../lib/supabase");
          const { data: user } = await supabase
            .from("users")
            .select("daily_ai_usage, last_reset_date")
            .eq("address", address)
            .single();

          if (user) {
            const lastReset = new Date(user.last_reset_date);
            const now = new Date();
            const isToday =
              lastReset.getDate() === now.getDate() &&
              lastReset.getMonth() === now.getMonth() &&
              lastReset.getFullYear() === now.getFullYear();

            // Calculate next reset time (midnight)
            const tomorrow = new Date(now);
            tomorrow.setDate(tomorrow.getDate() + 1);
            tomorrow.setHours(0, 0, 0, 0);

            setAiLimit({
              usage: isToday ? user.daily_ai_usage || 0 : 0,
              limit: 3, // ✅ Changed from 5 to 3
              resetTime: tomorrow.toISOString(),
            });
          }
        } catch (e) {
          console.error("Error fetching AI limit:", e);
        }
      }
    };
    fetchAiLimit();
  }, [address]);

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleImageChange = (imageData: string) => {
    setDrawnImage(imageData);
    setFormData((prev) => ({ ...prev, imageUrl: imageData }));
  };

  // AI Draw functions
  const generateAIImage = async () => {
    if (!aiPrompt.trim()) {
      showError(
        "Please enter a description for your AI-generated art",
        "AI generation"
      );
      return;
    }

    setAiGenerating(true);
    try {
      showAIMessages.loading();

      // Use the AI service with Gemini and other providers
      const response = await fetch("/api/ai", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "image",
          description: aiPrompt,
          userAddress: address,
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          const data = await response.json();
          // Update limit info with reset time
          if (data.resetTime) {
            setAiLimit((prev) => ({
              ...prev,
              resetTime: data.resetTime,
            }));
          }
          throw new Error(data.error || "Daily limit reached");
        }
        throw new Error(`AI generation failed: ${response.status}`);
      }

      const result = await response.json();

      if (result.imageUrl) {
        setAiGeneratedImage(result.imageUrl);
        setDrawnImage(result.imageUrl);
        setFormData((prev) => ({ ...prev, imageUrl: result.imageUrl }));
        setAiLimit((prev) => ({ ...prev, usage: prev.usage + 1 })); // Optimistic update
        showAIMessages.success();
      } else {
        throw new Error("No image URL returned from AI service");
      }
    } catch (error) {
      console.error("AI generation error:", error);
      showAIMessages.error(error);
    } finally {
      setAiGenerating(false);
    }
  };

  const handleDrawModeChange = (mode: "custom" | "ai") => {
    if (mode === "ai" && !isConnected) {
      showError(
        "Please connect your wallet to use AI generation",
        "Wallet Required"
      );
      return;
    }

    setDrawMode(mode);
    if (mode === "custom") {
      // Reset AI state when switching to custom
      setAiPrompt("");
      setAiGeneratedImage("");
      if (!drawnImage || drawnImage === aiGeneratedImage) {
        setDrawnImage("");
        setFormData((prev) => ({ ...prev, imageUrl: "" }));
      }
    } else {
      // Reset custom drawing when switching to AI
      if (drawnImage && drawnImage !== aiGeneratedImage) {
        setDrawnImage("");
        setFormData((prev) => ({ ...prev, imageUrl: "" }));
      }
    }
  };

  // Note: ETH price fetching removed as initial purchase is no longer supported

  // Note: ETH balance tracking removed as initial purchase is no longer supported

  // Note: Purchase amount calculation removed as initial purchase is no longer supported

  // Note: Purchase amount functions removed as initial purchase is no longer supported

  // Set canvas size based on screen size
  useEffect(() => {
    const updateCanvasSize = () => {
      if (window.innerWidth < 768) {
        // Mobile: smaller but still good size
        setCanvasSize({ width: 400, height: 400 });
      } else if (window.innerWidth < 1024) {
        // Tablet: medium size
        setCanvasSize({ width: 600, height: 600 });
      } else {
        // Desktop: large size
        setCanvasSize({ width: 1024, height: 1024 });
      }
    };

    updateCanvasSize();
    window.addEventListener("resize", updateCanvasSize);
    return () => window.removeEventListener("resize", updateCanvasSize);
  }, []);

  // Note: Purchase amount useEffect removed as initial purchase is no longer supported

  // Note: ETH price useEffect removed as initial purchase is no longer supported

  const uploadToIPFS = async (
    imageData: string,
    name: string,
    symbol: string,
    description: string
  ) => {
    try {
      showIPFSMessages.loading();

      const response = await fetch("/api/ipfs/upload", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          imageUrl: imageData,
          name,
          symbol,
          description,
        }),
      });

      if (!response.ok) {
        throw new Error(`IPFS upload failed: ${response.status}`);
      }

      const result = await response.json();

      if (result.success && result.ipfsUrl) {
        showIPFSMessages.success();
        return result.ipfsUrl;
      } else {
        throw new Error(result.error || "IPFS upload failed");
      }
    } catch (error) {
      console.error("IPFS upload error:", error);
      showIPFSMessages.error(error);
      throw error;
    }
  };

  const getStepStatus = (step: number) => {
    if (step < currentStep) return "completed";
    if (step === currentStep) return "current";
    return "upcoming";
  };

  const canProceedToNext = () => {
    switch (currentStep) {
      case 1:
        return drawMode !== null; // Sadece draw mode seçilmiş olmalı
      case 2:
        return formData.name && formData.symbol && formData.description; // Name, symbol ve description gerekli
      case 3:
        return isConnected;
      default:
        return false;
    }
  };

  const nextStep = async () => {
    if (!canProceedToNext() || currentStep >= totalSteps) return;

    // Step 1'den 2'ye geçerken otomatik capture al
    if (currentStep === 1 && drawMode === "custom" && customCanvasRef.current) {
      const image = await customCanvasRef.current.exportImage();
      if (image) {
        handleImageChange(image);
        toast.success("Artwork captured!");
      } else {
        toast.error("Draw something first!");
        return;
      }
    }

    setCurrentStep(currentStep + 1);
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSuccessModalClose = () => {
    setShowSuccessModal(false);
    // Navigate to token detail page when modal is closed
    if (createdTokenAddress && onSuccess) {
      onSuccess(createdTokenAddress);
    }
  };

  const handleCreateToken = async (isRetry: boolean = false) => {
    if (!isConnected || !walletClient || !publicClient || !address) {
      showError("Please connect your wallet first", "wallet connection");
      return;
    }

    if (
      !formData.name ||
      !formData.symbol ||
      !formData.description ||
      !formData.imageUrl
    ) {
      showError("Please complete all steps first", "form validation");
      return;
    }

    setLoading(true);

    try {
      // First upload image to IPFS
      const ipfsUrl = await uploadToIPFS(
        formData.imageUrl,
        formData.name,
        formData.symbol,
        formData.description
      );

      const tokenData = {
        name: formData.name,
        symbol: formData.symbol,
        description: formData.description,
        imageUrl: ipfsUrl, // Use IPFS URL instead of base64
        category: "DrawCoin",
        creation_type:
          drawMode === "ai" ? ("ai" as const) : ("hand-drawn" as const),
        // Note: Initial purchase parameters removed as not supported in SDK v2
        ownersAddresses: ownersAddresses,
        selectedCurrency: selectedCurrency,
        startingMarketCap: startingMarketCap,
        smartWalletRouting: smartWalletRouting,
        platformReferrer: platformReferrer,
      };

      const result = await createToken(
        tokenData,
        walletClient,
        publicClient,
        address,
        switchChain
      );

      if (result.address) {
        showCreateMessages.success();

        // Reset retry count on success
        setRetryCount(0);

        // Set the created token address and show success modal
        setCreatedTokenAddress(result.address);
        setShowSuccessModal(true);
      }
    } catch (error: any) {
      console.error("Error creating token:", error);

      // Check if we should retry
      if (retryCount < maxRetries && !isRetry) {
        const newRetryCount = retryCount + 1;
        setRetryCount(newRetryCount);

        showCreateMessages.retry(newRetryCount, maxRetries);

        // Wait 2 seconds before retry
        setTimeout(() => {
          handleCreateToken(true);
        }, 2000);
      } else {
        // Final failure
        setRetryCount(0);
        showCreateMessages.finalError(maxRetries);
      }
    } finally {
      setLoading(false);
    }
  };

  // Show skeleton on initial load
  if (initialLoading) {
    return (
      <div className="min-h-screen bg-art-off-white">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="space-y-6">
            {/* Header Skeleton */}
            <div className="flex justify-between items-center">
              <HandDrawnSkeleton variant="text" className="w-64 h-10" />
              <HandDrawnSkeleton variant="text" className="w-48 h-10" />
            </div>

            {/* Navigation Skeleton */}
            <div className="hand-drawn-card p-4">
              <HandDrawnSkeleton variant="text" className="w-full h-12" />
            </div>

            {/* Canvas/Content Skeleton */}
            <div className="hand-drawn-card p-6">
              <div className="space-y-4">
                <HandDrawnSkeleton variant="text" className="w-1/3 h-6" />
                <div className="w-full h-96 bg-art-gray-200 rounded-art animate-pulse" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-art-off-white">
      <div className="max-w-7xl mx-auto px-4">
        {/* Tab and Steps - Responsive Layout */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4 space-y-3 md:space-y-0">
          {/* Tab Navigation */}
          <div className="flex justify-center md:justify-start mt-5">
            <div className="flex space-x-2">
              <button
                onClick={() => handleDrawModeChange("custom")}
                className={`flex items-center ${
                  drawMode === "custom"
                    ? "hand-drawn-btn"
                    : "hand-drawn-btn-dotted secondary"
                }`}
                style={{ padding: "0.75rem 1.5rem" }}
              >
                <HandDrawnIcon type="art" />
                <span className="ml-2">Custom Draw</span>
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  handleDrawModeChange("ai");
                }}
                title={
                  !isConnected ? "Connect wallet to use AI" : "Generate AI Art"
                }
                className={`flex items-center ${
                  drawMode === "ai"
                    ? "hand-drawn-btn"
                    : "hand-drawn-btn-dotted secondary"
                } ${!isConnected ? "opacity-70 cursor-pointer" : ""}`}
                style={{ padding: "0.75rem 1.5rem" }}
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                  />
                </svg>
                <span className="ml-2">AI Draw</span>
              </button>
            </div>
          </div>

          {/* Progress Steps - Responsive Design */}
          <div className="flex justify-center md:justify-end">
            <div className="flex flex-col items-center">
              {/* Mobile: Compact Step Indicators */}
              <div className="md:hidden flex items-center space-x-4 mb-2">
                {[1, 2, 3].map((step) => (
                  <div key={step} className="flex flex-col items-center">
                    <div
                      className={`flex items-center justify-center w-8 h-8 rounded-full border-2 transition-all duration-300 ${
                        getStepStatus(step) === "completed"
                          ? "bg-green-500 border-green-500 text-white"
                          : getStepStatus(step) === "current"
                          ? "bg-art-gray-900 border-art-gray-900 text-white"
                          : "bg-white border-art-gray-300 text-art-gray-400"
                      }`}
                      style={{
                        borderRadius: "50% 30% 50% 30%",
                      }}
                    >
                      {getStepStatus(step) === "completed" ? (
                        <svg
                          className="w-4 h-4"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      ) : (
                        <span className="text-xs font-bold">{step}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Mobile: Current Step Label */}
              <div className="md:hidden text-xs text-art-gray-600 font-medium mb-1">
                {currentStep === 1 && "Draw Your Art"}
                {currentStep === 2 && "Add Details"}
                {currentStep === 3 && "Create Token"}
              </div>

              {/* Mobile: Progress Text */}
              <div className="md:hidden text-xs text-art-gray-400">
                Step {currentStep} of {totalSteps}
              </div>

              {/* Desktop: Full Progress Bar */}
              <div className="hidden md:block">
                {/* Progress Bar Container */}
                <div className="relative w-full max-w-md">
                  {/* Background Progress Bar */}
                  <div
                    className="absolute top-1/2 left-0 w-full h-2 bg-art-gray-200 rounded-full transform -translate-y-1/2"
                    style={{ borderRadius: "20px 5px 15px 8px" }}
                  >
                    {/* Active Progress Bar */}
                    <div
                      className="h-full bg-gradient-to-r from-art-gray-900 to-art-gray-700 rounded-full transition-all duration-500 ease-out"
                      style={{
                        width: `${((currentStep - 1) / 2) * 100}%`,
                        borderRadius: "20px 5px 15px 8px",
                        boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                      }}
                    />
                  </div>

                  {/* Step Indicators */}
                  <div className="relative flex justify-between items-center">
                    {[1, 2, 3].map((step) => (
                      <div key={step} className="flex flex-col items-center">
                        <div
                          className={`flex items-center justify-center w-12 h-12 rounded-full border-3 transition-all duration-300 transform ${
                            getStepStatus(step) === "completed"
                              ? "bg-green-500 border-green-500 text-white scale-110 shadow-lg"
                              : getStepStatus(step) === "current"
                              ? "bg-art-gray-900 border-art-gray-900 text-white scale-110 shadow-lg ring-4 ring-art-gray-200"
                              : "bg-white border-art-gray-300 text-art-gray-400 hover:scale-105"
                          }`}
                          style={{
                            borderRadius: "50% 30% 50% 30%",
                            borderStyle: "solid",
                            borderWidth: "3px",
                          }}
                        >
                          {getStepStatus(step) === "completed" ? (
                            <svg
                              className="w-6 h-6"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path
                                fillRule="evenodd"
                                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                clipRule="evenodd"
                              />
                            </svg>
                          ) : (
                            <span className="text-base font-bold">{step}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="w-full">
          {/* Navigation Buttons - Top (Desktop Only) */}
          <div className="hidden md:flex justify-between items-center mb-4 px-4 py-3 bg-white border-2 border-gray-200 rounded-art">
            <button
              onClick={prevStep}
              disabled={currentStep === 1}
              className="hand-drawn-btn secondary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ← Previous
            </button>
            <div className="text-center">
              <span className="text-sm font-bold text-gray-600">
                Step {currentStep} of {totalSteps}
              </span>
            </div>
            {currentStep < totalSteps && (
              <button
                onClick={nextStep}
                disabled={!canProceedToNext()}
                className="hand-drawn-btn disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next →
              </button>
            )}
            {currentStep === totalSteps && <div className="w-24"></div>}
          </div>

          {/* Current Step Only */}
          {/* Step 1: Draw Your Art */}
          {currentStep === 1 && (
            <div className="space-y-4">
              {/* Content based on selected mode */}
              {drawMode === "custom" ? (
                <div className="w-full max-w-full mx-auto">
                  <CustomCanvas
                    ref={customCanvasRef}
                    width={canvasSize.width}
                    height={canvasSize.height}
                  />
                </div>
              ) : (
                /* AI Draw Mode */
                <div className="flex flex-col lg:flex-row gap-4">
                  {/* AI Generation Area */}
                  <div className="flex-1">
                    <div
                      className="hand-drawn-card"
                      style={{ transform: "rotate(-0.5deg)" }}
                    >
                      <div className="hand-drawn-header">
                        <svg
                          className="w-5 h-5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                          />
                        </svg>
                        <div className="flex-1 flex justify-between items-center ml-2">
                          <h3 className="text-lg">AI Art Generation</h3>
                          <span
                            className={`text-xs font-bold px-2 py-1 rounded-full border ${
                              aiLimit.usage >= aiLimit.limit
                                ? "bg-red-100 text-red-600 border-red-200"
                                : "bg-green-100 text-green-600 border-green-200"
                            }`}
                          >
                            {Math.max(0, aiLimit.limit - aiLimit.usage)} left
                          </span>
                        </div>
                      </div>
                      <p className="text-xs md:text-sm text-art-gray-600 mb-4 md:mb-6">
                        Describe what you want to create and let AI generate
                        hand-drawn style artwork for your token
                      </p>

                      {/* AI Prompt Input */}
                      <div className="mb-4">
                        <label className="hand-drawn-label">
                          Describe your artwork
                        </label>
                        <textarea
                          value={aiPrompt}
                          onChange={(e) => setAiPrompt(e.target.value)}
                          placeholder="Describe what you want to create... (e.g., 'A beautiful sunset over mountains', 'Abstract geometric patterns', 'A cute cartoon character')"
                          className="hand-drawn-textarea"
                          rows={4}
                          maxLength={500}
                        />
                        <div className="text-xs text-art-gray-500 mt-1 text-right">
                          {aiPrompt.length}/500
                        </div>
                      </div>

                      {/* Limit Reached Warning */}
                      {isAiLimitReached && (
                        <div className="mb-4 bg-red-50 border-2 border-red-200 rounded-art p-4">
                          <div className="flex items-start space-x-3">
                            <svg
                              className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path
                                fillRule="evenodd"
                                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                                clipRule="evenodd"
                              />
                            </svg>
                            <div className="flex-1">
                              <h4 className="text-sm font-bold text-red-800 mb-1">
                                Daily Limit Reached ({aiLimit.limit}/
                                {aiLimit.limit})
                              </h4>
                              <p className="text-xs text-red-700">
                                You've used all your AI generations for today.
                                {aiLimit.resetTime && (
                                  <span className="font-semibold">
                                    {" "}
                                    Reset in: {getRemainingTime()}
                                  </span>
                                )}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Generate Button */}
                      <button
                        onClick={generateAIImage}
                        disabled={
                          aiGenerating || !aiPrompt.trim() || isAiLimitReached
                        }
                        className="hand-drawn-btn w-full text-lg py-4 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {aiGenerating ? (
                          <div className="flex items-center justify-center">
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                            Generating AI Art...
                          </div>
                        ) : isAiLimitReached ? (
                          <div className="flex items-center justify-center">
                            <svg
                              className="w-5 h-5 mr-2"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path
                                fillRule="evenodd"
                                d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z"
                                clipRule="evenodd"
                              />
                            </svg>
                            Available in {getRemainingTime()}
                          </div>
                        ) : aiGeneratedImage ? (
                          <div className="flex items-center justify-center">
                            <svg
                              className="w-5 h-5 mr-2"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                              />
                            </svg>
                            Regenerate
                          </div>
                        ) : (
                          <div className="flex items-center justify-center">
                            <svg
                              className="w-5 h-5 mr-2"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                              />
                            </svg>
                            Generate AI Art
                          </div>
                        )}
                      </button>

                      {/* Generation Progress */}
                      {aiGenerating && (
                        <div className="mt-4 bg-art-off-white rounded-art p-4 border border-art-gray-200">
                          <div className="flex items-center space-x-3">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-art-gray-900"></div>
                            <div className="text-sm text-art-gray-600">
                              <div className="font-medium">
                                Creating your artwork...
                              </div>
                              <div className="text-xs text-art-gray-500 mt-1">
                                This may take 30-60 seconds. Please don't close
                                this page.
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Generated Image Preview */}
                      {aiGeneratedImage && (
                        <div className="mt-6">
                          <label className="hand-drawn-label">
                            Generated Artwork
                          </label>
                          <div className="art-preview">
                            <img
                              src={aiGeneratedImage}
                              alt="AI Generated Art"
                              className="w-full h-auto rounded-art border border-art-gray-200"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* AI Info Panel - Hand-drawn Card Style */}
                  <div className="w-full lg:w-72">
                    <div
                      className="hand-drawn-card"
                      style={{ transform: "rotate(0.3deg)" }}
                    >
                      <div className="hand-drawn-header">
                        <HandDrawnIcon type="art" />
                        <h3 className="text-lg">AI Art Tips</h3>
                      </div>
                      <p className="text-xs md:text-sm text-art-gray-600 mb-4 md:mb-6">
                        Get the best results from AI art generation
                      </p>

                      <div className="space-y-3 text-sm text-art-gray-600">
                        <div>
                          <strong>Be descriptive:</strong> Add details for
                          better results.
                        </div>
                        <div>
                          <strong>Examples:</strong>
                          <ul className="mt-2 space-y-1 text-xs">
                            <li>• "A cute cat"</li>
                            <li>• "Mountain landscape"</li>
                            <li>• "Vintage car"</li>
                          </ul>
                        </div>
                        <div className="bg-art-off-white rounded-art p-3 border border-art-gray-200">
                          <strong>Note:</strong> AI generates hand-drawn style
                          artwork at 1024x1024 resolution.
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Add Details */}
          {currentStep === 2 && (
            <div className="hand-drawn-card">
              <div className="hand-drawn-header">
                <HandDrawnIcon type="art" />
                <h3 className="text-lg md:text-xl">Add Token Details</h3>
              </div>
              <p className="text-xs md:text-sm text-art-gray-600 mb-4 md:mb-6">
                Add your token name, symbol, and describe your artwork
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 sm:gap-4 gap-2 mb-2">
                <div>
                  <label className="hand-drawn-label">Token Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleInputChange("name", e.target.value)}
                    placeholder="Enter your token name..."
                    className="hand-drawn-input"
                    maxLength={50}
                  />
                  <div className="text-xs text-art-gray-500 text-right">
                    {formData.name.length}/50
                  </div>
                </div>

                <div>
                  <label className="hand-drawn-label">Token Symbol</label>
                  <input
                    type="text"
                    value={formData.symbol}
                    onChange={(e) =>
                      handleInputChange("symbol", e.target.value)
                    }
                    placeholder="Enter token symbol..."
                    className="hand-drawn-input"
                    maxLength={10}
                  />
                  <div className="text-xs text-art-gray-500 text-right">
                    {formData.symbol.length}/10
                  </div>
                </div>
              </div>

              <div>
                <label className="hand-drawn-label">Art Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) =>
                    handleInputChange("description", e.target.value)
                  }
                  placeholder="Describe your artwork, inspiration, and what makes it unique..."
                  className="hand-drawn-textarea"
                  rows={6}
                  maxLength={500}
                />
                <div className="text-xs text-art-gray-500 mt-1 text-right">
                  {formData.description.length}/500
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Create Token */}
          {currentStep === 3 && (
            <div className="flex flex-col lg:flex-row gap-2 p-4">
              {/* Art Preview - Left Side */}
              <div className="flex-1 flex justify-center order-1 lg:order-1">
                <div className="w-full max-w-7xl">
                  <div className="art-preview">
                    {drawnImage && (
                      <img
                        src={drawnImage}
                        alt="Your artwork"
                        className="w-full h-auto rounded-art border border-art-gray-200"
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* Token Options - Right Side */}
              <div className="w-full lg:w-96 order-2 lg:order-2">
                <div className="hand-drawn-card lg:sticky lg:top-4">
                  <div className="hand-drawn-header">
                    <HandDrawnIcon type="coin" />
                    <h3 className="text-lg">Create Token</h3>
                  </div>

                  {/* Advanced Options Toggle */}
                  <div className="mb-4">
                    <button
                      type="button"
                      onClick={() =>
                        setShowAdvancedOptions(!showAdvancedOptions)
                      }
                      className="flex items-center justify-between w-full p-3 text-left bg-gray-50 hover:bg-gray-100 rounded-art border border-gray-200 transition-colors"
                    >
                      <span className="text-sm font-medium text-art-gray-700">
                        Advanced Options
                      </span>
                      <svg
                        className={`w-4 h-4 text-art-gray-500 transition-transform ${
                          showAdvancedOptions ? "rotate-180" : ""
                        }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </button>
                  </div>

                  {/* Advanced Options Content */}
                  {showAdvancedOptions && (
                    <div className="mb-6 p-4 bg-gray-50 rounded-art border border-gray-200">
                      {/* Starting Market Cap Selection */}
                      <div className="mb-4">
                        <label className="hand-drawn-label mb-3">
                          Starting Market Cap
                        </label>
                        <div className="space-y-3">
                          <div className="flex items-center space-x-3">
                            <input
                              type="radio"
                              id="low-market-cap"
                              name="marketCap"
                              value="0"
                              checked={startingMarketCap === 0}
                              onChange={(e) =>
                                setStartingMarketCap(Number(e.target.value))
                              }
                              className="w-4 h-4 text-art-gray-900"
                            />
                            <label
                              htmlFor="low-market-cap"
                              className="text-sm text-art-gray-700"
                            >
                              <span className="font-bold">LOW</span> - Lower
                              initial liquidity, more price volatility
                            </label>
                          </div>
                          <div className="flex items-center space-x-3">
                            <input
                              type="radio"
                              id="high-market-cap"
                              name="marketCap"
                              value="1"
                              checked={startingMarketCap === 1}
                              onChange={(e) =>
                                setStartingMarketCap(Number(e.target.value))
                              }
                              className="w-4 h-4 text-art-gray-900"
                            />
                            <label
                              htmlFor="high-market-cap"
                              className="text-sm text-art-gray-700"
                            >
                              <span className="font-bold">HIGH</span> - Higher
                              initial liquidity, more stable pricing
                            </label>
                          </div>
                        </div>
                        <div className="mt-2 text-xs text-art-gray-500">
                          This affects the initial trading conditions and price
                          discovery for your token.
                        </div>
                      </div>

                      {/* Co-Owners Section */}
                      <div className="mb-4">
                        <label className="hand-drawn-label mb-3">
                          Co-Owners (Optional)
                        </label>
                        <div className="text-xs text-art-gray-500 mb-3">
                          Add Ethereum addresses as additional owners. Co-owners
                          will have full administrative control over the token
                          contract, including the ability to manage token
                          settings and parameters.
                        </div>

                        {/* Owner Input */}
                        <div className="flex items-center space-x-2 mb-3">
                          <input
                            type="text"
                            value={ownerInputValue}
                            onChange={(e) => setOwnerInputValue(e.target.value)}
                            placeholder="0x..."
                            className="hand-drawn-input flex-1"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const trimmed = ownerInputValue.trim();
                              if (
                                trimmed &&
                                trimmed.startsWith("0x") &&
                                trimmed.length === 42
                              ) {
                                if (!ownersAddresses.includes(trimmed)) {
                                  setOwnersAddresses([
                                    ...ownersAddresses,
                                    trimmed,
                                  ]);
                                  setOwnerInputValue("");
                                } else {
                                  alert("This address is already added");
                                }
                              } else {
                                alert("Please enter a valid Ethereum address");
                              }
                            }}
                            className="hand-drawn-btn px-4 py-2"
                          >
                            Add
                          </button>
                        </div>

                        {/* Owners List */}
                        {ownersAddresses.length > 0 && (
                          <div className="space-y-2">
                            <div className="text-xs font-bold text-art-gray-700 mb-2">
                              Co-Owners ({ownersAddresses.length}):
                            </div>
                            {ownersAddresses.map((addr, idx) => (
                              <div
                                key={idx}
                                className="flex items-center justify-between bg-gray-100 px-3 py-2 rounded-art border border-gray-300"
                              >
                                <span className="text-xs font-mono text-art-gray-700 truncate">
                                  {addr}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOwnersAddresses(
                                      ownersAddresses.filter(
                                        (_, i) => i !== idx
                                      )
                                    );
                                  }}
                                  className="text-red-500 hover:text-red-700 ml-2 font-bold"
                                >
                                  ✕
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <button
                    onClick={() => handleCreateToken(false)}
                    disabled={
                      loading ||
                      !isConnected ||
                      !formData.name ||
                      !formData.symbol ||
                      !formData.imageUrl
                    }
                    className="hand-drawn-btn w-full text-lg py-4"
                  >
                    {loading ? (
                      <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                        {retryCount > 0
                          ? `Retrying... (${retryCount}/${maxRetries})`
                          : "Creating Token..."}
                      </div>
                    ) : (
                      <div className="flex items-center justify-center">
                        <HandDrawnIcon type="coin" />
                        <span className="ml-2">Create Token</span>
                      </div>
                    )}
                  </button>

                  {!isConnected && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-art p-4 mt-4">
                      <div className="flex items-center">
                        <svg
                          className="w-5 h-5 text-yellow-600 mr-2"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                          />
                        </svg>
                        <p className="text-sm text-yellow-800">
                          Please connect your wallet to create your token
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Navigation Buttons - Bottom (Mobile Only) */}
          <div className="md:hidden flex justify-between items-center mt-3 mb-6 px-3 py-2 bg-white border-2 border-gray-200 rounded-art">
            <button
              onClick={prevStep}
              disabled={currentStep === 1}
              className="hand-drawn-btn secondary disabled:opacity-50 disabled:cursor-not-allowed text-sm px-3 py-2"
            >
              ← Prev
            </button>
            <div className="text-center">
              <span className="text-xs font-bold text-gray-600">
                {currentStep}/{totalSteps}
              </span>
            </div>
            {currentStep < totalSteps && (
              <button
                onClick={nextStep}
                disabled={!canProceedToNext()}
                className="hand-drawn-btn disabled:opacity-50 disabled:cursor-not-allowed text-sm px-3 py-2"
              >
                Next →
              </button>
            )}
            {currentStep === totalSteps && <div className="w-20"></div>}
          </div>
        </div>
      </div>

      {/* Success Modal */}
      <SuccessModal
        isOpen={showSuccessModal}
        onClose={handleSuccessModalClose}
        tokenName={formData.name}
        tokenSymbol={formData.symbol}
        tokenAddress={createdTokenAddress}
        tokenImage={formData.imageUrl}
      />
    </div>
  );
}
