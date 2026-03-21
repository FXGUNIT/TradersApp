/**
 * Retry a function with exponential backoff
 * @param {Function} fn - Function to execute
 * @param {number} maxRetries - Maximum number of retry attempts (default: 3)
 * @param {number} initialDelay - Initial delay in ms (default: 100)
 * @returns {Promise} Result of function execution
 */
export const withExponentialBackoff = async (fn, maxRetries = 3, initialDelay = 100) => {
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt === maxRetries) {
        console.error(`Operation failed after ${maxRetries + 1} attempts:`, error);
        throw error;
      }

      const delayMs = initialDelay * Math.pow(2, attempt);
      console.warn(`Attempt ${attempt + 1} failed, retrying in ${delayMs}ms...`, error.message);

      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  throw lastError;
};
