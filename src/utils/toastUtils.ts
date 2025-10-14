import { toast } from 'react-hot-toast';

// Toast IDs for consistent management
export const TOAST_IDS = {
  NETWORK_SWITCH: 'network-switch',
  TRADE: 'trade-toast',
  CREATE: 'create-toast',
  APPROVE: 'approve-toast',
  IPFS: 'ipfs-toast',
  AI_GENERATE: 'ai-generate',
  WALLET_ERROR: 'wallet-error',
  FORM_ERROR: 'form-error',
  BALANCE_ERROR: 'balance-error',
  GENERIC_ERROR: 'generic-error',
} as const;

// User-friendly error messages
export const ERROR_MESSAGES = {
  // Network errors
  NETWORK_SWITCH_REJECTED: 'Network switch was rejected. Please switch to Base network manually.',
  NETWORK_SWITCH_FAILED: 'Please switch to Base network manually in your wallet.',
  WRONG_NETWORK: 'Please switch to Base network to continue.',
  
  // Wallet errors
  WALLET_NOT_CONNECTED: 'Please connect your wallet first',
  WALLET_REJECTED: 'Transaction was rejected',
  WALLET_CANCELLED: 'Transaction was cancelled',
  
  // Balance errors
  INSUFFICIENT_ETH: 'Insufficient ETH balance',
  INSUFFICIENT_TOKENS: 'Insufficient token balance',
  INSUFFICIENT_GAS: 'Insufficient ETH for gas fees',
  
  // Trade errors
  TRADE_FAILED: 'Trade failed. Please try again.',
  TRADE_REJECTED: 'Trade was rejected',
  TRADE_CANCELLED: 'Trade was cancelled',
  COIN_NOT_READY: 'This coin is not ready for trading yet',
  API_UNAVAILABLE: 'Trading service is temporarily unavailable',
  
  // Create errors
  CREATE_FAILED: 'Failed to create token. Please try again.',
  CREATE_REJECTED: 'Token creation was rejected',
  CREATE_CANCELLED: 'Token creation was cancelled',
  INVALID_METADATA: 'Invalid token metadata',
  
  // Approve errors
  APPROVE_FAILED: 'Approval failed. Please try again.',
  APPROVE_REJECTED: 'Approval was rejected',
  APPROVE_CANCELLED: 'Approval was cancelled',
  APPROVE_REQUIRED: 'Token approval required! Please approve the token first.',
  
  // IPFS errors
  IPFS_UPLOAD_FAILED: 'Failed to upload image. Please try again.',
  IPFS_INVALID_URL: 'Invalid image URL',
  
  // AI errors
  AI_GENERATION_FAILED: 'Failed to generate AI art. Please try again.',
  AI_INVALID_PROMPT: 'Please enter a valid description',
  
  // Form errors
  FORM_INCOMPLETE: 'Please complete all required fields',
  FORM_INVALID: 'Please check your input and try again',
  
  // Generic errors
  UNKNOWN_ERROR: 'An unexpected error occurred. Please try again.',
  NETWORK_ERROR: 'Network error. Please check your connection.',
  TIMEOUT_ERROR: 'Request timed out. Please try again.',
} as const;

// Success messages
export const SUCCESS_MESSAGES = {
  NETWORK_SWITCHED: 'Successfully switched to Base network',
  TRADE_SUCCESS: 'Trade completed successfully!',
  CREATE_SUCCESS: 'Token created successfully!',
  APPROVE_SUCCESS: 'Approval completed successfully!',
  IPFS_UPLOAD_SUCCESS: 'Image uploaded successfully!',
  AI_GENERATION_SUCCESS: 'AI art generated successfully!',
} as const;

// Loading messages
export const LOADING_MESSAGES = {
  NETWORK_SWITCHING: 'Switching to Base network...',
  TRADING: 'Processing trade...',
  CREATING: 'Creating token...',
  APPROVING: 'Approving tokens...',
  UPLOADING: 'Uploading image...',
  AI_GENERATING: 'Generating AI art...',
  LOADING: 'Loading...',
} as const;

/**
 * Shows a user-friendly error message based on error type
 */
export const showError = (error: any, context?: string) => {
  console.error(`Error in ${context || 'operation'}:`, error);
  
  const errorMessage = error?.message || error?.toString() || '';
  
  // Network errors
  if (errorMessage.includes('rejected') || errorMessage.includes('denied')) {
    return toast.error(ERROR_MESSAGES.WALLET_REJECTED, { 
      id: TOAST_IDS.GENERIC_ERROR,
      duration: 4000 
    });
  }
  
  if (errorMessage.includes('cancelled') || errorMessage.includes('canceled')) {
    return toast.error(ERROR_MESSAGES.WALLET_CANCELLED, { 
      id: TOAST_IDS.GENERIC_ERROR,
      duration: 3000 
    });
  }
  
  // Balance errors
  if (errorMessage.includes('insufficient funds') || errorMessage.includes('insufficient balance')) {
    return toast.error(ERROR_MESSAGES.INSUFFICIENT_ETH, { 
      id: TOAST_IDS.BALANCE_ERROR,
      duration: 5000 
    });
  }
  
  // Network errors
  if (errorMessage.includes('network') || errorMessage.includes('chain')) {
    return toast.error(ERROR_MESSAGES.WRONG_NETWORK, { 
      id: TOAST_IDS.NETWORK_SWITCH,
      duration: 5000 
    });
  }
  
  // API errors
  if (errorMessage.includes('500') || errorMessage.includes('Internal Server Error')) {
    return toast.error(ERROR_MESSAGES.API_UNAVAILABLE, { 
      id: TOAST_IDS.GENERIC_ERROR,
      duration: 5000 
    });
  }
  
  // Timeout errors
  if (errorMessage.includes('timeout') || errorMessage.includes('timed out')) {
    return toast.error(ERROR_MESSAGES.TIMEOUT_ERROR, { 
      id: TOAST_IDS.GENERIC_ERROR,
      duration: 4000 
    });
  }
  
  // Generic error - show shortened message
  const shortMessage = errorMessage.length > 100 ? 
    errorMessage.substring(0, 100) + '...' : 
    errorMessage || ERROR_MESSAGES.UNKNOWN_ERROR;
    
  return toast.error(shortMessage, { 
    id: TOAST_IDS.GENERIC_ERROR,
    duration: 5000 
  });
};

/**
 * Shows a success message
 */
export const showSuccess = (message: string, id?: string) => {
  return toast.success(message, { 
    id: id || TOAST_IDS.GENERIC_ERROR,
    duration: 4000 
  });
};

/**
 * Shows a loading message
 */
export const showLoading = (message: string, id: string) => {
  return toast.loading(message, { 
    id,
    duration: 0 // Don't auto-dismiss loading toasts
  });
};

/**
 * Updates an existing toast
 */
export const updateToast = (id: string, message: string, type: 'success' | 'error' | 'loading' = 'success') => {
  if (type === 'success') {
    toast.success(message, { id });
  } else if (type === 'error') {
    toast.error(message, { id });
  } else {
    toast.loading(message, { id });
  }
};

/**
 * Dismisses a toast
 */
export const dismissToast = (id: string) => {
  toast.dismiss(id);
};

/**
 * Shows trade-specific messages
 */
export const showTradeMessages = {
  loading: (direction: 'buy' | 'sell', amount: string, currency: string) => 
    showLoading(`${direction === 'buy' ? 'Buying' : 'Selling'} ${amount} ${currency}...`, TOAST_IDS.TRADE),
  
  success: (direction: 'buy' | 'sell') => 
    showSuccess(`Successfully ${direction === 'buy' ? 'bought' : 'sold'} tokens!`, TOAST_IDS.TRADE),
  
  error: (error: any) => showError(error, 'trade'),
  
  approve: () => 
    showLoading('Approving tokens for trading... This may require 2 transactions.', TOAST_IDS.APPROVE),
  
  approveRequired: (tokenName: string = 'token') => 
    showError(`Token approval required! Please approve ${tokenName} first in your wallet, then try again.`, TOAST_IDS.APPROVE),
};

/**
 * Shows create-specific messages
 */
export const showCreateMessages = {
  loading: () => 
    showLoading('Creating your art token - this may take a moment...', TOAST_IDS.CREATE),
  
  success: () => 
    showSuccess('Your hand-drawn art token has been created successfully!', TOAST_IDS.CREATE),
  
  error: (error: any) => showError(error, 'create'),
  
  retry: (attempt: number, maxAttempts: number) => 
    showError(`Failed to create token. Retrying... (${attempt}/${maxAttempts})`, TOAST_IDS.CREATE),
  
  finalError: (maxAttempts: number) => 
    showError(`Failed to create token after ${maxAttempts} attempts. Please check your network connection and try again.`, TOAST_IDS.CREATE),
};

/**
 * Shows network-specific messages
 */
export const showNetworkMessages = {
  switching: () => 
    showLoading(LOADING_MESSAGES.NETWORK_SWITCHING, TOAST_IDS.NETWORK_SWITCH),
  
  success: () => 
    showSuccess(SUCCESS_MESSAGES.NETWORK_SWITCHED, TOAST_IDS.NETWORK_SWITCH),
  
  error: (error: any) => {
    const errorMessage = error?.message || '';
    if (errorMessage.includes('rejected') || errorMessage.includes('denied')) {
      return toast.error(ERROR_MESSAGES.NETWORK_SWITCH_REJECTED, { 
        id: TOAST_IDS.NETWORK_SWITCH,
        duration: 5000 
      });
    }
    return toast.error(ERROR_MESSAGES.NETWORK_SWITCH_FAILED, { 
      id: TOAST_IDS.NETWORK_SWITCH,
      duration: 5000 
    });
  },
};

/**
 * Shows IPFS-specific messages
 */
export const showIPFSMessages = {
  loading: () => 
    showLoading(LOADING_MESSAGES.UPLOADING, TOAST_IDS.IPFS),
  
  success: () => 
    showSuccess(SUCCESS_MESSAGES.IPFS_UPLOAD_SUCCESS, TOAST_IDS.IPFS),
  
  error: (error: any) => showError(error, 'IPFS upload'),
};

/**
 * Shows AI-specific messages
 */
export const showAIMessages = {
  loading: () => 
    showLoading(LOADING_MESSAGES.AI_GENERATING, TOAST_IDS.AI_GENERATE),
  
  success: () => 
    showSuccess(SUCCESS_MESSAGES.AI_GENERATION_SUCCESS, TOAST_IDS.AI_GENERATE),
  
  error: (error: any) => showError(error, 'AI generation'),
};
