import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAccount, useWalletClient, usePublicClient, useSwitchChain } from "wagmi";
import { createToken } from "../../lib/functions/createToken";
import { toast } from "react-hot-toast";
import DrawingCanvas from "../ui/DrawingCanvas";
import HandDrawnIcon from "../ui/HandDrawnIcon";
import { sdk as miniAppSdk } from '@farcaster/miniapp-sdk';
import SuccessModal from './SuccessModal';

interface CreatePageProps {
  onSuccess?: (tokenAddress: string) => void;
}

export default function CreatePage({ onSuccess }: CreatePageProps) {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const { switchChain } = useSwitchChain();

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    symbol: "",
    description: "",
    imageUrl: "",
  });

  // Purchase and fee optimization state
  const [selectedPurchaseAmount, setSelectedPurchaseAmount] =
    useState<string>("1.00");
  const [selectedPurchasePercentage, setSelectedPurchasePercentage] =
    useState<number>(1);
  const [userEthBalance, setUserEthBalance] = useState<bigint>(BigInt(0));
  const [ethToUsdRate, setEthToUsdRate] = useState<number>(0);
  const [isCustomAmount, setIsCustomAmount] = useState<boolean>(false);
  const [isPurchaseEnabled, setIsPurchaseEnabled] = useState<boolean>(true);
  const [ownersAddresses, setOwnersAddresses] = useState<string[]>([]);
  const [newOwnerAddress, setNewOwnerAddress] = useState<string>("");
  const [selectedCurrency, setSelectedCurrency] = useState<number>(0); // DeployCurrency.ZORA
  const [platformReferrer, setPlatformReferrer] = useState<string>(
    "0xbFA6A45Dd534d39dF47A3F3D2f2b6E88416f9831"
  );

  // UI state
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [drawnImage, setDrawnImage] = useState<string>("");
  const [currentStep, setCurrentStep] = useState(1);
  const [canvasSize, setCanvasSize] = useState({ width: 1024, height: 1024 });
  const [drawingTools, setDrawingTools] = useState<React.ReactNode>(null);
  const [isMobile, setIsMobile] = useState<boolean>(false);
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
      toast.error("Please enter a description for your AI-generated art");
      return;
    }

    setAiGenerating(true);
    try {
      toast.loading("Generating AI art...", { id: "ai-generate" });

      // Use the AI service with Gemini and other providers
      const response = await fetch("/api/ai", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "image",
          description: aiPrompt,
        }),
      });

      if (!response.ok) {
        throw new Error(`AI generation failed: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.imageUrl) {
        setAiGeneratedImage(result.imageUrl);
        setDrawnImage(result.imageUrl);
        setFormData((prev) => ({ ...prev, imageUrl: result.imageUrl }));
        toast.success("AI art generated successfully!", {
          id: "ai-generate",
        });
      } else {
        throw new Error("No image URL returned from AI service");
      }
    } catch (error) {
      console.error("AI generation error:", error);
      toast.error("Failed to generate AI art. Please try again.", {
        id: "ai-generate",
      });
    } finally {
      setAiGenerating(false);
    }
  };

  const handleDrawModeChange = (mode: "custom" | "ai") => {
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

  // Get ETH price in USD with cache
  const ethPriceCache: { value: number | null; timestamp: number } = {
    value: null,
    timestamp: 0,
  };
  const CACHE_DURATION_MS = 60 * 10000; // 10 minutes

  const fetchEthPrice = useCallback(async () => {
    const now = Date.now();
    if (
      ethPriceCache.value !== null &&
      now - ethPriceCache.timestamp < CACHE_DURATION_MS
    ) {
      setEthToUsdRate(ethPriceCache.value);
      return;
    }
    try {
      const response = await fetch(
        "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd"
      );
      const data = await response.json();
      if (data && data.ethereum && data.ethereum.usd) {
        ethPriceCache.value = data.ethereum.usd;
        ethPriceCache.timestamp = now;
        setEthToUsdRate(data.ethereum.usd);
      }
    } catch (error) {
      console.error("Failed to fetch ETH price:", error);
      // Use fallback price if API fails
      setEthToUsdRate(3000);
    }
  }, []);

  // Update user's ETH balance
  const updateUserBalance = useCallback(async () => {
    if (isConnected && address && publicClient) {
      try {
        const balance = await publicClient.getBalance({ address });
        setUserEthBalance(balance);
        console.log(
          `User ETH balance: ${balance} wei (${Number(balance) / 10 ** 18} ETH)`
        );
      } catch (error) {
        console.error("Failed to get user balance:", error);
      }
    }
  }, [isConnected, address, publicClient]);

  // Calculate purchase amount based on percentage of balance
  const calculatePurchaseAmount = useCallback(
    (percentage: number): string => {
      if (userEthBalance === BigInt(0)) return "0.001";

      // Calculate percentage of balance (leave some for gas)
      const maxUsableBalance = (userEthBalance * BigInt(90)) / BigInt(100); // Use max 90% of balance to leave gas
      const amount = (maxUsableBalance * BigInt(percentage)) / BigInt(100);

      // Convert to ETH (with 5 decimal places)
      const ethAmount = Number(amount) / 10 ** 18;

      // Ensure minimum amount of 0.001 ETH
      const finalAmount = Math.max(ethAmount, 0.001);

      // Format to 5 decimal places max
      return finalAmount.toFixed(5);
    },
    [userEthBalance]
  );

  // Set predefined amount with 1% slippage margin for 100%
  const setPredefinedAmount = (percentage: number) => {
    // If requesting 100%, actually use 99% to leave room for gas (1% slippage)
    const actualPercentage = percentage === 100 ? 99 : percentage;
    setSelectedPurchasePercentage(actualPercentage);
    setIsCustomAmount(false);
  };

  // Handle custom amount change
  const handleCustomAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSelectedPurchaseAmount(value);
    setIsCustomAmount(true);
  };

  // Add owner address
  const addOwnerAddress = () => {
    if (newOwnerAddress && !ownersAddresses.includes(newOwnerAddress)) {
      setOwnersAddresses([...ownersAddresses, newOwnerAddress]);
      setNewOwnerAddress("");
    }
  };

  // Remove owner address
  const removeOwnerAddress = (address: string) => {
    setOwnersAddresses(ownersAddresses.filter((item) => item !== address));
  };

  // Set canvas size based on screen size
  useEffect(() => {
    const updateCanvasSize = () => {
      setIsMobile(window.innerWidth < 768);
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

  // Update purchase amount when slider changes, only if not in custom mode
  useEffect(() => {
    if (!isCustomAmount) {
      const newAmount = calculatePurchaseAmount(selectedPurchasePercentage);
      setSelectedPurchaseAmount(newAmount);
    }
  }, [selectedPurchasePercentage, calculatePurchaseAmount, isCustomAmount]);

  useEffect(() => {
    fetchEthPrice();
    updateUserBalance();
  }, [fetchEthPrice]);

  // Update balance when wallet connection changes
  useEffect(() => {
    updateUserBalance();
  }, [isConnected, address, updateUserBalance]);

  const uploadToIPFS = async (
    imageData: string,
    name: string,
    symbol: string,
    description: string
  ) => {
    try {
      toast.loading("Uploading image to IPFS...", { id: "ipfs-toast" });

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
        toast.success("Image uploaded to IPFS successfully!", {
          id: "ipfs-toast",
        });
        return result.ipfsUrl;
      } else {
        throw new Error(result.error || "IPFS upload failed");
      }
    } catch (error) {
      console.error("IPFS upload error:", error);
      toast.error("Failed to upload image to IPFS. Please try again.", { 
        id: "ipfs-toast", 
        duration: 5000 
      });
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
        return drawnImage; // Sadece çizim yeterli (hem custom hem AI draw için)
      case 2:
        return formData.name && formData.symbol && formData.description; // Name, symbol ve description gerekli
      case 3:
        return isConnected;
      default:
        return false;
    }
  };

  const nextStep = () => {
    if (canProceedToNext() && currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    }
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

  const handleViewToken = () => {
    setShowSuccessModal(false);
    // Navigate to token detail page
    if (createdTokenAddress && onSuccess) {
      onSuccess(createdTokenAddress);
    }
  };

  const handleCreateToken = async (isRetry: boolean = false) => {
    if (!isConnected || !walletClient || !publicClient || !address) {
      toast.error("Please connect your wallet first", { id: 'wallet-error' });
      return;
    }

    if (
      !formData.name ||
      !formData.symbol ||
      !formData.description ||
      !formData.imageUrl
    ) {
      toast.error("Please complete all steps first", { id: 'form-error' });
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
        selectedPurchaseAmount: selectedPurchaseAmount,
        isPurchaseEnabled: isPurchaseEnabled,
        ownersAddresses: ownersAddresses,
        selectedCurrency: selectedCurrency,
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
        toast.success(
          "Your hand-drawn art token has been created successfully!",
          { id: 'create-success', duration: 4000 }
        );
        
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
        
        toast.error(
          `Failed to create token. Retrying... (${newRetryCount}/${maxRetries})`,
          { duration: 5000, id: 'create-retry' }
        );
        
        // Wait 2 seconds before retry
        setTimeout(() => {
          handleCreateToken(true);
        }, 2000);
      } else {
        // Final failure
        setRetryCount(0);
        toast.error(
          `Failed to create token after ${maxRetries} attempts. Please check your network connection and try again.`,
          { duration: 8000, id: 'create-final-error' }
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-art-off-white">
      <div className="max-w-7xl mx-auto px-4">
        {/* Tab and Steps - Responsive Layout */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4 space-y-3 md:space-y-0">
          {/* Tab Navigation */}
          <div className="flex justify-center md:justify-start mt-5">
            <div className="flex space-x-2">
              <button
                onClick={() => handleDrawModeChange('custom')}
                className={`hand-drawn-btn flex items-center ${
                  drawMode === 'custom' ? '' : 'secondary'
                }`}
                style={{ padding: "0.75rem 1.5rem" }}
              >
                <HandDrawnIcon type="art" />
                <span className="ml-2">Custom Draw</span>
              </button>
              <button
                onClick={() => handleDrawModeChange('ai')}
                className={`hand-drawn-btn flex items-center ${
                  drawMode === 'ai' ? '' : 'secondary'
                }`}
                style={{ padding: "0.75rem 1.5rem" }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                <span className="ml-2">AI Draw</span>
              </button>
            </div>
          </div>

          {/* Progress Steps */}
          <div className="flex justify-center md:justify-end">
            <div className="flex flex-col items-center">
              {/* Step Circles */}
              <div className="flex items-center">
                {[1, 2, 3].map((step) => (
                  <div key={step} className="flex items-center">
                    <div
                      className={`flex items-center justify-center w-8 h-8 md:w-10 md:h-10 rounded-full border-2 transition-all duration-300 ${
                        getStepStatus(step) === "completed"
                          ? "bg-green-500 border-green-500 text-white"
                          : getStepStatus(step) === "current"
                          ? "bg-art-gray-900 border-art-gray-900 text-white"
                          : "bg-white border-art-gray-300 text-art-gray-400"
                      }`}
                    >
                      {getStepStatus(step) === "completed" ? (
                        <svg
                          className="w-4 h-4 md:w-5 md:h-5"
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
                        <span className="text-xs md:text-sm font-medium">
                          {step}
                        </span>
                      )}
                    </div>
                    {step < 3 && (
                      <div
                        className={`w-8 md:w-16 h-0.5 mx-2 md:mx-4 transition-all duration-300 ${
                          getStepStatus(step) === "completed"
                            ? "bg-green-500"
                            : "bg-art-gray-300"
                        }`}
                      />
                    )}
                  </div>
                ))}
              </div>
              
              {/* Step Labels - Desktop Only */}
              <div className="hidden md:flex justify-center mt-2 text-xs text-art-gray-500 space-x-8">
                <span>Draw Your Art</span>
                <span>Add Details</span>
                <span>Create Token</span>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto">
          {/* Current Step Only */}
          {/* Step 1: Draw Your Art */}
          {currentStep === 1 && (
            <div className="space-y-4">

              {/* Content based on selected mode */}
              {drawMode === "custom" ? (
                <div className={`flex flex-col lg:flex-row gap-4 p-2`}>
                  {/* Canvas Area */}
                  <div className="flex-1 flex justify-center order-1 lg:order-1">
                    <div className="w-full max-w-4xl">
                      <DrawingCanvas
                        width={canvasSize.width}
                        height={canvasSize.height}
                        onImageChange={handleImageChange}
                        showTools={false}
                        onToolsRender={setDrawingTools}
                        toolsVariant={isMobile ? "compact" : "full"}
                      />
                      {/* Mobile Tools directly under canvas */}
                      {isMobile && drawingTools && (
                        <div className="mt-3 block lg:hidden">
                          {drawingTools}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Tools Panel */}
                  <div className="w-full lg:w-80 order-2 lg:order-2">
                    <div className="hand-drawn-card lg:sticky lg:top-4 hidden lg:block">
                      {/* Drawing tools from canvas */}
                      {drawingTools || (
                        <div className="space-y-3">
                          <div className="text-sm text-art-gray-500">
                            Tools are loading...
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
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
                        <h3 className="text-lg">AI Art Generation</h3>
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

                      {/* Generate Button */}
                      <button
                        onClick={generateAIImage}
                        disabled={aiGenerating || !aiPrompt.trim()}
                        className="hand-drawn-btn w-full text-lg py-4"
                      >
                        {aiGenerating ? (
                          <div className="flex items-center justify-center">
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                            Generating AI Art...
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
                          <strong>Be descriptive:</strong> Add details for better results.
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
                          <strong>Note:</strong> AI generates hand-drawn style artwork at 1024x1024 resolution.
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
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
                  <div className="text-xs text-art-gray-500 mt-1 text-right">
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
                  <div className="text-xs text-art-gray-500 mt-1 text-right">
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

                  {/* Purchase Options */}
                  <div className="bg-art-off-white rounded-art p-4 border border-art-gray-200 mb-6">
                    {/* Purchase Toggle */}
                    <div className="flex items-center justify-between mb-4">
                      <label className="hand-drawn-label">
                        Enable Initial Purchase
                      </label>
                      <button
                        onClick={() => setIsPurchaseEnabled(!isPurchaseEnabled)}
                        className={`hand-drawn-btn ${
                          isPurchaseEnabled ? "" : "secondary"
                        }`}
                        style={{ padding: "0.5rem 1rem" }}
                      >
                        {isPurchaseEnabled ? "Enabled" : "Disabled"}
                      </button>
                    </div>

                    {isPurchaseEnabled && (
                      <div className="space-y-4">
                        {/* Purchase Amount Slider */}
                        <div>
                          <label className="hand-drawn-label mb-2">
                            Purchase Amount: {selectedPurchaseAmount} ETH
                            {ethToUsdRate > 0 && (
                              <span className="text-art-gray-500 ml-2">
                                ($
                                {(
                                  parseFloat(selectedPurchaseAmount) *
                                  ethToUsdRate
                                ).toFixed(2)}
                                )
                              </span>
                            )}
                          </label>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={selectedPurchasePercentage}
                            onChange={(e) =>
                              setPredefinedAmount(Number(e.target.value))
                            }
                            className="w-full h-2 bg-art-gray-200 rounded-lg appearance-none cursor-pointer"
                          />
                          <div className="flex justify-between text-xs text-art-gray-500 mt-1">
                            <span>0%</span>
                            <span>25%</span>
                            <span>50%</span>
                            <span>75%</span>
                            <span>100%</span>
                          </div>
                        </div>

                        {/* Quick Amount Buttons */}
                        <div className="flex gap-2 flex-wrap">
                          {[1, 25, 50, 75, 100].map((percentage) => (
                            <button
                              key={percentage}
                              onClick={() => setPredefinedAmount(percentage)}
                              className="hand-drawn-btn text-xs"
                              style={{ padding: "0.4rem 0.8rem" }}
                            >
                              {percentage}%
                            </button>
                          ))}
                        </div>

                        {/* Custom Amount Input */}
                        <div>
                          <label className="hand-drawn-label">
                            Custom Amount (ETH)
                          </label>
                          <input
                            type="number"
                            value={selectedPurchaseAmount}
                            onChange={handleCustomAmountChange}
                            placeholder="0.01"
                            step="0.001"
                            min="0.001"
                            className="hand-drawn-input"
                          />
                        </div>
                      </div>
                    )}
                  </div>

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
                        {retryCount > 0 ? `Retrying... (${retryCount}/${maxRetries})` : 'Creating Token...'}
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

          {/* Navigation Buttons */}
          <div className="flex justify-between mt-6">
            <button
              onClick={prevStep}
              disabled={currentStep === 1}
              className="hand-drawn-btn secondary"
            >
              Previous
            </button>
            {currentStep < totalSteps && (
              <button
                onClick={nextStep}
                disabled={!canProceedToNext()}
                className="hand-drawn-btn"
              >
                Next
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Success Modal */}
      <SuccessModal
        isOpen={showSuccessModal}
        onClose={handleSuccessModalClose}
        onViewToken={handleViewToken}
        tokenName={formData.name}
        tokenSymbol={formData.symbol}
        tokenAddress={createdTokenAddress}
        tokenImage={formData.imageUrl}
      />
    </div>
  );
}
