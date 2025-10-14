import { base } from 'viem/chains';
import { showNetworkMessages } from '../utils/toastUtils';

/**
 * Checks if the user is on the Base network and switches if necessary
 * @param {Object} params - Parameters
 * @param {number} params.chainId - Current chain ID
 * @param {Function} params.switchChain - Network switch function
 * @returns {Promise<boolean>} - If network check is successful, returns true
 */
export const checkAndSwitchNetwork = async ({ chainId, switchChain }) => {
  // If user is not on Base, request switch
  if (chainId !== base.id) {
    try {
      // Show notification about network switching
      showNetworkMessages.switching();
      
      // Attempt to switch network
      await switchChain({ chainId: base.id });
      
      // If successful, show success message
      showNetworkMessages.success();
      
      return true;
    } catch (error) {
      console.error('Network switch error:', error);
      
      // Show user-friendly error message
      showNetworkMessages.error(error);
      
      return false;
    }
  }
  
  return true;
};
