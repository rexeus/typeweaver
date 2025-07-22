export const captureError = <T = Error>(fn: () => void): T | undefined => {
  try {
    fn();
  } catch (error) {
    return error as T;
  }
  return undefined;
};