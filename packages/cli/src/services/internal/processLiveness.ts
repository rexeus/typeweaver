import { errnoCode } from "./nodeFsErrors.js";

/**
 * Liveness probe for an output-lock owner. Signal 0 performs error checking
 * without sending a signal. `EPERM` means the process exists but is owned by
 * another user, so it is still alive. Only `ESRCH` proves the PID has no live
 * process; unknown platform errors are treated conservatively as alive.
 */
export const isProcessAlive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return errnoCode(error) !== "ESRCH";
  }
};
