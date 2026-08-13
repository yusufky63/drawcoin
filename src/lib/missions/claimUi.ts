import type { BadgeClaimStatus } from "./types";

export type MissionClaimUiState =
  | "incomplete"
  | "claimable"
  | "submitting"
  | "pending"
  | "claimed"
  | "unavailable";

export interface MissionClaimAction {
  state: MissionClaimUiState;
  label: string;
  message: string;
  disabled: boolean;
}

export function getMissionClaimAction(input: {
  isCompleted: boolean;
  claimStatus: BadgeClaimStatus | null;
  isSubmitting: boolean;
  hasDeployableMetadata: boolean;
  contractConfigured: boolean | null;
}): MissionClaimAction {
  if (!input.isCompleted) {
    return {
      state: "incomplete",
      label: "In progress",
      message: "Complete the mission to unlock its badge.",
      disabled: true,
    };
  }

  if (input.claimStatus === "claimed") {
    return {
      state: "claimed",
      label: "Claimed",
      message: "Badge claimed.",
      disabled: true,
    };
  }

  if (input.claimStatus === "pending") {
    return {
      state: "pending",
      label: "Confirming",
      message: "Your badge claim is being confirmed.",
      disabled: true,
    };
  }

  if (input.isSubmitting) {
    return {
      state: "submitting",
      label: "Claim pending",
      message: "Confirm the badge claim in your wallet.",
      disabled: true,
    };
  }

  if (!input.hasDeployableMetadata) {
    return {
      state: "unavailable",
      label: "Completed",
      message: "Badge claim is not live yet.",
      disabled: true,
    };
  }

  if (input.contractConfigured !== true) {
    return {
      state: "unavailable",
      label: "Completed",
      message: "Badge claim is not live yet.",
      disabled: true,
    };
  }

  return {
    state: "claimable",
    label: input.claimStatus === "failed" ? "Retry claim" : "Claim badge",
    message: "Ready to claim.",
    disabled: false,
  };
}
