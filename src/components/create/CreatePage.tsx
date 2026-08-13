import React, { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import {
  useAccount,
  useWalletClient,
  usePublicClient,
  useSwitchChain,
} from "wagmi";
import {
  createToken,
  syncCreatedToken,
  type CoinRecordStatus,
} from "../../lib/functions/createToken";
import {
  showCreateMessages,
  showIPFSMessages,
  showError,
} from "../../utils/toastUtils";
import CustomCanvas, {
  type CustomCanvasDraft,
  type CustomCanvasRef,
} from "../ui/CustomCanvas";
import HandDrawnIcon from "../ui/HandDrawnIcon";
import SuccessModal from "./SuccessModal";
import { toast } from "react-hot-toast";
import HandDrawnSkeleton from "../ui/HandDrawnSkeleton";
import { useWalletSession } from "@/hooks/useWalletSession";
import { normalizeAdditionalOwners } from "@/lib/create/additionalOwners";
import { DRAWCOIN_PLATFORM_REFERRER } from "@/lib/drawcoinPlatform";
import {
  clearCreateDraft,
  clearPendingCreation,
  loadCreateDraft,
  loadPendingCreation,
  saveCreateDraft,
  savePendingCreation,
  type PendingCreationV1,
} from "@/lib/create/draftStorage";

interface CreatePageProps {
  onSuccess?: (tokenAddress: string) => void;
}

const STEP_LABELS = ["Draw your art", "Add details", "Create token"] as const;

export default function CreatePage({ onSuccess }: CreatePageProps) {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const { switchChainAsync } = useSwitchChain();
  const {
    session,
    status: sessionStatus,
    signIn,
  } = useWalletSession();
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
  const [showAdvancedOptions, setShowAdvancedOptions] =
    useState<boolean>(false);
  const platformReferrer = DRAWCOIN_PLATFORM_REFERRER;

  // UI state
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [drawnImage, setDrawnImage] = useState<string>("");
  const [currentStep, setCurrentStep] = useState(1);
  const [canvasDraft, setCanvasDraft] = useState<CustomCanvasDraft | null>(null);
  const [uploadedMetadataUrl, setUploadedMetadataUrl] = useState("");
  const [draftStorageAvailable, setDraftStorageAvailable] = useState(true);
  const totalSteps = STEP_LABELS.length;
  const currentStepLabel = STEP_LABELS[currentStep - 1] ?? STEP_LABELS[0];

  // Success modal state
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [createdTokenAddress, setCreatedTokenAddress] = useState<string>("");
  const [createdTransactionHash, setCreatedTransactionHash] = useState("");
  const [recordStatus, setRecordStatus] =
    useState<CoinRecordStatus>("recorded");
  const [recordError, setRecordError] = useState<string | null>(null);
  const [pendingCreation, setPendingCreation] =
    useState<PendingCreationV1 | null>(null);
  const [syncingCreation, setSyncingCreation] = useState(false);
  const [creationFinalized, setCreationFinalized] = useState(false);

  useEffect(() => {
    const storedDraft = loadCreateDraft();
    if (storedDraft) {
      const hasArtwork = Boolean(storedDraft.canvas?.elements.length);
      const hasDetails = Boolean(
        storedDraft.details.name.trim() &&
          storedDraft.details.symbol.trim() &&
          storedDraft.details.description.trim()
      );
      const restoredStep = !hasArtwork
        ? 1
        : storedDraft.currentStep === 3 && !hasDetails
        ? 2
        : storedDraft.currentStep;

      setCanvasDraft(storedDraft.canvas);
      setCurrentStep(restoredStep);
      setFormData((previous) => ({
        ...previous,
        ...storedDraft.details,
      }));
      setOwnersAddresses(storedDraft.options.ownersAddresses);
    }

    const storedPendingCreation = loadPendingCreation();
    if (storedPendingCreation) {
      setPendingCreation(storedPendingCreation);
      setCreatedTokenAddress(storedPendingCreation.tokenAddress ?? "");
      setCreatedTransactionHash(storedPendingCreation.transactionHash);
      setRecordStatus("sync_required");
      setRecordError(
        "The Base transaction succeeded, but DrawCoin still needs to sync it to Explore."
      );
      setFormData((previous) => ({
        ...previous,
        name: storedPendingCreation.payload.name,
        symbol: storedPendingCreation.payload.symbol,
        description: storedPendingCreation.payload.description,
      }));
    }

    setInitialLoading(false);
  }, []);

  const handleInputChange = (
    field: "name" | "symbol" | "description",
    value: string
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setUploadedMetadataUrl("");
    setCreationFinalized(false);
  };

  const handleImageChange = useCallback((imageData: string) => {
    setDrawnImage(imageData);
    setFormData((prev) => ({ ...prev, imageUrl: imageData }));
  }, []);

  const handleCanvasDraftChange = useCallback((draft: CustomCanvasDraft) => {
    setCanvasDraft(draft);
    setUploadedMetadataUrl("");
    if (draft.elements.length > 0) setCreationFinalized(false);
  }, []);

  // Note: ETH price fetching removed as initial purchase is no longer supported

  // Note: ETH balance tracking removed as initial purchase is no longer supported

  // Note: Purchase amount calculation removed as initial purchase is no longer supported

  // Note: Purchase amount functions removed as initial purchase is no longer supported

  useEffect(() => {
    if (initialLoading || creationFinalized) return;

    const timeoutId = window.setTimeout(() => {
      const saved = saveCreateDraft({
        version: 1,
        updatedAt: Date.now(),
        currentStep: currentStep as 1 | 2 | 3,
        canvas: canvasDraft,
        details: {
          name: formData.name,
          symbol: formData.symbol,
          description: formData.description,
        },
        options: {
          ownersAddresses,
        },
      });
      setDraftStorageAvailable(saved);
    }, 650);

    return () => window.clearTimeout(timeoutId);
  }, [
    canvasDraft,
    creationFinalized,
    currentStep,
    formData.description,
    formData.name,
    formData.symbol,
    initialLoading,
    ownersAddresses,
  ]);

  useEffect(() => {
    if (initialLoading || currentStep === 1 || !canvasDraft?.elements.length) {
      return;
    }

    let cancelled = false;
    const frameId = window.requestAnimationFrame(() => {
      void customCanvasRef.current?.exportImage().then((image) => {
        if (!cancelled && image) handleImageChange(image);
      });
    });

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frameId);
    };
  }, [canvasDraft, currentStep, handleImageChange, initialLoading]);

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

  const canProceedToNext = () => {
    switch (currentStep) {
      case 1:
        return true;
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
    if (currentStep === 1 && customCanvasRef.current) {
      if (!customCanvasRef.current.hasContent()) {
        toast.error("Draw something before continuing.");
        return;
      }

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

    if (recordStatus === "recorded" && createdTokenAddress && onSuccess) {
      onSuccess(createdTokenAddress);
      return;
    }

    if (recordStatus === "recorded") {
      customCanvasRef.current?.clearCanvas();
      setCanvasDraft(null);
      setDrawnImage("");
      setFormData({ name: "", symbol: "", description: "", imageUrl: "" });
      setOwnersAddresses([]);
      setOwnerInputValue("");
      setUploadedMetadataUrl("");
      setCreatedTokenAddress("");
      setCreatedTransactionHash("");
      setRecordError(null);
      setCurrentStep(1);
      clearCreateDraft();
    }
  };

  const handleCreateToken = async () => {
    if (pendingCreation) {
      setRecordStatus("sync_required");
      setShowSuccessModal(true);
      toast(
        "Sync the existing Base transaction to Explore before creating another token.",
        { icon: "↻" }
      );
      return;
    }

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
      if (
        sessionStatus !== "authenticated" ||
        !session ||
        session.address.toLowerCase() !== address.toLowerCase()
      ) {
        await signIn();
      }

      // A manual retry after a cancelled wallet request reuses the same IPFS
      // metadata URI and does not consume another permanent upload quota.
      const ipfsUrl =
        uploadedMetadataUrl ||
        (await uploadToIPFS(
          formData.imageUrl,
          formData.name,
          formData.symbol,
          formData.description
        ));
      setUploadedMetadataUrl(ipfsUrl);

      const tokenData = {
        name: formData.name,
        symbol: formData.symbol,
        description: formData.description,
        imageUrl: ipfsUrl, // Use IPFS URL instead of base64
        category: "DrawCoin",
        creation_type: "hand-drawn" as const,
        // Note: Initial purchase parameters removed as not supported in SDK v2
        ownersAddresses: ownersAddresses,
        selectedCurrency: selectedCurrency,
        platformReferrer: platformReferrer,
      };

      const result = await createToken(
        tokenData,
        walletClient,
        publicClient,
        address,
        switchChainAsync
      );

      const tokenAddress =
        result.contractAddress ??
        result.address ??
        result.recordedCoin?.contract_address ??
        result.recoveryPayload.contract_address ??
        "";

      setCreatedTokenAddress(tokenAddress);
      setCreatedTransactionHash(result.transactionHash);
      setRecordStatus(result.recordStatus);
      setRecordError(result.recordError?.message ?? null);

      if (result.recordStatus === "recorded") {
        setPendingCreation(null);
        setCreationFinalized(true);
        clearPendingCreation();
        clearCreateDraft();
        showCreateMessages.success();
      } else {
        const pending: PendingCreationV1 = {
          version: 1,
          updatedAt: Date.now(),
          transactionHash: result.transactionHash,
          tokenAddress: tokenAddress || null,
          payload: result.recoveryPayload,
        };
        setPendingCreation(pending);
        let recoverySaved = savePendingCreation(pending);
        if (!recoverySaved) {
          // A successful Base transaction is more important than an editable
          // pre-mint draft. Free that space once, then retry the recovery record.
          clearCreateDraft();
          recoverySaved = savePendingCreation(pending);
          setDraftStorageAvailable(false);
        }
        if (!recoverySaved) {
          setRecordError(
            "DrawCoin could not save this recovery locally. Keep this page open until sync succeeds."
          );
        }
        toast(
          "Your token is live on Base. Use Sync to Explore to finish the DrawCoin record.",
          { icon: "↻", duration: 6_000 }
        );
      }

      setShowSuccessModal(true);
    } catch (error: unknown) {
      console.error("Error creating token:", error);
      showCreateMessages.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleRetrySync = async () => {
    if (!pendingCreation) return;
    if (!isConnected || !address) {
      showError("Connect the wallet that created this token first.", "coin sync");
      return;
    }
    if (
      pendingCreation.payload.creator_address.toLowerCase() !==
      address.toLowerCase()
    ) {
      showError(
        "Connect the same wallet that created this Base transaction.",
        "coin sync"
      );
      return;
    }

    setSyncingCreation(true);
    setRecordError(null);

    try {
      if (
        sessionStatus !== "authenticated" ||
        !session ||
        session.address.toLowerCase() !== address.toLowerCase()
      ) {
        await signIn();
      }

      const result = await syncCreatedToken(pendingCreation.payload);
      if (result.status === "recorded") {
        const syncedAddress =
          result.coin?.contract_address ?? pendingCreation.tokenAddress ?? "";
        setCreatedTokenAddress(syncedAddress);
        setRecordStatus("recorded");
        setRecordError(null);
        setPendingCreation(null);
        setCreationFinalized(true);
        clearPendingCreation();
        clearCreateDraft();
        setShowSuccessModal(true);
        toast.success("Synced to Explore. No second mint was created.");
        return;
      }

      const updatedPending: PendingCreationV1 = {
        ...pendingCreation,
        updatedAt: Date.now(),
        payload: result.recoveryPayload,
      };
      setPendingCreation(updatedPending);
      let recoverySaved = savePendingCreation(updatedPending);
      if (!recoverySaved) {
        clearCreateDraft();
        recoverySaved = savePendingCreation(updatedPending);
        setDraftStorageAvailable(false);
      }
      setRecordStatus("sync_required");
      setRecordError(
        recoverySaved
          ? result.error?.message ?? "Sync is temporarily unavailable."
          : "Sync is unavailable and recovery could not be saved locally. Keep this page open."
      );
      setShowSuccessModal(true);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Sync is temporarily unavailable.";
      setRecordStatus("sync_required");
      setRecordError(message);
      setShowSuccessModal(true);
      showError(error, "coin sync");
    } finally {
      setSyncingCreation(false);
    }
  };

  // Show skeleton on initial load
  if (initialLoading) {
    return (
      <div className="min-h-screen bg-art-off-white">
        <div className="mx-auto max-w-7xl px-3 pb-6 pt-2 sm:px-4 sm:pt-3">
          <div className="rounded-art border-2 border-art-gray-200 bg-white p-3 sm:p-4">
            <div className="space-y-3">
              <HandDrawnSkeleton variant="text" className="h-9 w-full" />
              <div className="aspect-square w-full max-w-[44rem] rounded-art bg-art-gray-200 animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-art-off-white">
      <div className="mx-auto max-w-7xl px-3 pb-6 pt-2 sm:px-4 sm:pt-3">

        {pendingCreation && (
          <section
            aria-labelledby="pending-creation-title"
            className="mb-4 rounded-[16px_7px_14px_9px] border-2 border-amber-700 bg-amber-50 px-3 py-3 shadow-[3px_3px_0_#92400e] sm:px-4"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <h2
                  id="pending-creation-title"
                  className="text-sm font-bold text-amber-950"
                >
                  Base creation waiting for Explore sync
                </h2>
                <p className="mt-0.5 text-xs leading-5 text-amber-900">
                  The mint already succeeded. Syncing only records that same
                  transaction in DrawCoin; it will not create another token.
                </p>
                {recordError && (
                  <p aria-live="polite" className="mt-1 text-xs text-amber-800">
                    {recordError}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <a
                  href={`https://basescan.org/tx/${pendingCreation.transactionHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-10 items-center justify-center rounded-art border-2 border-amber-800 bg-white px-3 text-xs font-bold text-amber-950 hover:bg-amber-100"
                >
                  View transaction
                </a>
                <button
                  type="button"
                  onClick={handleRetrySync}
                  disabled={syncingCreation}
                  className="hand-drawn-btn min-h-10 px-3 text-xs disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {syncingCreation ? "Syncing…" : "Sync to Explore"}
                </button>
              </div>
            </div>
          </section>
        )}

        <div className="w-full">
          {/* Current Step Only */}
          {/* Step 1: Draw Your Art */}
          <div
            className={currentStep === 1 ? "space-y-2" : "hidden"}
            aria-hidden={currentStep !== 1}
          >
            <div className="w-full max-w-full mx-auto">
              <CustomCanvas
                ref={customCanvasRef}
                width={1024}
                height={1024}
                initialDraft={canvasDraft}
                onDraftChange={handleCanvasDraftChange}
                interactionEnabled={currentStep === 1}
              />
            </div>
            {!draftStorageAvailable ? (
              <p
                className="px-1 text-center text-[11px] text-amber-700 sm:text-xs"
                role="status"
              >
                Local draft saving is unavailable. Keep this page open.
              </p>
            ) : null}
          </div>

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
                      <Image
                        src={drawnImage}
                        alt="Your artwork"
                        width={1024}
                        height={1024}
                        sizes="(max-width: 1024px) 100vw, 70vw"
                        unoptimized
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
                      onClick={() => setShowAdvancedOptions((visible) => !visible)}
                      aria-expanded={showAdvancedOptions}
                      aria-controls="advanced-token-options"
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
                    <div
                      id="advanced-token-options"
                      className="mb-6 p-4 bg-gray-50 rounded-art border border-gray-200"
                    >
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
                              if (!address) {
                                alert("Connect your wallet before adding co-owners");
                                return;
                              }

                              try {
                                const normalizedOwners = normalizeAdditionalOwners(
                                  [...ownersAddresses, trimmed],
                                  address
                                );
                                if (
                                  normalizedOwners.length === ownersAddresses.length
                                ) {
                                  alert("This address is already added");
                                  return;
                                }
                                setOwnersAddresses(normalizedOwners);
                                setOwnerInputValue("");
                              } catch (error) {
                                alert(
                                  error instanceof Error
                                    ? error.message
                                    : "Please enter a valid Ethereum address"
                                );
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
                    onClick={handleCreateToken}
                    disabled={
                      loading ||
                      Boolean(pendingCreation) ||
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
                        Creating Token...
                      </div>
                    ) : pendingCreation ? (
                      <div className="flex items-center justify-center">
                        <span>Sync Previous Token First</span>
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

          {/* Compact navigation below the active step */}
          <nav
            aria-label="Create token progress"
            className="mt-3 mb-6 flex items-center gap-2 border-t-2 border-art-gray-200 pt-3"
          >
            <span
              aria-live="polite"
              className="mr-auto min-w-0 truncate text-xs font-bold text-gray-500 sm:text-sm"
            >
              {currentStep}/{totalSteps} · {currentStepLabel}
            </span>
            {currentStep > 1 ? (
              <button
                type="button"
                onClick={prevStep}
                className="hand-drawn-btn secondary !min-h-10 !px-3 !py-1.5 text-sm"
              >
                ← Back
              </button>
            ) : null}
            {currentStep < totalSteps && (
              <button
                type="button"
                onClick={nextStep}
                disabled={!canProceedToNext()}
                className="hand-drawn-btn !min-h-10 !px-3 !py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
              >
                Continue →
              </button>
            )}
          </nav>
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
        transactionHash={createdTransactionHash}
        recordStatus={recordStatus}
        recordError={recordError}
        onRetrySync={handleRetrySync}
        isRetryingSync={syncingCreation}
      />
    </div>
  );
}
