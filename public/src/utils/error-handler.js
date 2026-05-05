export function withErrorHandling(callback, onError) {
  return async (...args) => {
    try {
      return await callback(...args);
    } catch (error) {
      console.error(error);
      onError?.(error);
      return undefined;
    }
  };
}
