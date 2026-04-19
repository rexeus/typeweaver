import type { Logger } from "../logger.js";
import type { BaseCheckResult } from "./types.js";

export const reportCheckSection = (
  logger: Logger,
  title: string,
  results: readonly BaseCheckResult[]
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
