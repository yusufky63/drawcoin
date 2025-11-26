/**
 * Format a number for display with appropriate decimal places
 * @param value - Number to format
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted string
 */
export function formatNumber(value: number | string, decimals: number = 2): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  
  if (isNaN(num)) return '0';
  
  // For very small numbers, use scientific notation
  if (Math.abs(num) < 0.01 && num !== 0) {
    return num.toExponential(decimals);
  }
  
  // For large numbers, use K/M/B notation
  if (Math.abs(num) >= 1000000000) {
    return (num / 1000000000).toFixed(decimals) + 'B';
  }
  if (Math.abs(num) >= 1000000) {
    return (num / 1000000).toFixed(decimals) + 'M';
  }
  if (Math.abs(num) >= 1000) {
    return (num / 1000).toFixed(decimals) + 'K';
  }
  
  return num.toFixed(decimals);
}
