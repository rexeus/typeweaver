import { reportCheckSection } from "../pipeline/reporting.js";
import type { Logger } from "../logger.js";
import type { DoctorCheckResult } from "./types.js";

export const reportDoctorChecks = (
  logger: Logger,
  results: readonly DoctorCheckResult[]
): void => {
  const standardResults = results.filter(result => result.phase === "standard");
  const deepResults = results.filter(result => result.phase === "deep");

  reportCheckSection(logger, "Standard checks", standardResults);

  if (deepResults.length > 0) {
    reportCheckSection(logger, "Deep checks", deepResults);
  }
};
