import type { Logger } from "../logger.js";
import type { DoctorCheckResult } from "./types.js";

export const reportDoctorChecks = (
  logger: Logger,
  results: readonly DoctorCheckResult[]
): void => {
  const standardResults = results.filter(result => result.phase === "standard");
  const deepResults = results.filter(result => result.phase === "deep");

  reportSection(logger, "Standard checks", standardResults);

  if (deepResults.length > 0) {
    reportSection(logger, "Deep checks", deepResults);
  }
};

const reportSection = (
  logger: Logger,
  title: string,
  results: readonly DoctorCheckResult[]
): void => {
  if (results.length === 0) {
    return;
  }

  logger.step(title);

  for (const result of results) {
    const message = `${result.label}: ${result.summary}`;

    switch (result.status) {
      case "pass":
        logger.success(message);
        break;
      case "warn":
        logger.warn(message);
        break;
      case "fail":
        logger.error(message);
        break;
      case "skip":
        logger.info(`○ ${message}`);
        break;
    }

    if (logger.isVerbose) {
      for (const detail of result.details) {
        logger.info(`  ${detail}`);
      }
    }
  }
};
