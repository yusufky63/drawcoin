import { base } from 'viem/chains';
import { toast } from 'react-hot-toast';

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
      toast.loading(`Switching to Base network...`, { id: "network-switch" });
      
      // Attempt to switch network
      await switchChain({ chainId: base.id });
      
      // If successful, show success message
      toast.success("Successfully switched to Base network", { id: "network-switch" });
      
      return true;
    } catch (error) {
      console.error('Network switch error:', error);
      
      // Show user-friendly error message
      if (error.message?.includes('rejected') || error.message?.includes('denied')) {
        toast.error("Network switch was rejected. Please switch to Base network manually.", { 
          id: "network-switch", 
          duration: 5000 
        });
      } else {
        toast.error(`Please switch to Base network manually in your wallet. (Error: ${error.message || 'Unknown error'})`, { 
          id: "network-switch", 
          duration: 5000 
        });
      }
      
      return false;
    }
  }
  
  return true;
};
