import { createCli } from "./cli.js";
import { writeDiagnostic } from "./diagnosticFormatter.js";
import { createLogger } from "./logger.js";

const main = async (): Promise<void> => {
  await createCli().parseAsync(process.argv);
};

main().catch((error: unknown) => {
  const logger = createLogger();

  logger.error("Failed to start TypeWeaver CLI.");
  writeDiagnostic(logger, error);
  process.exit(1);
});
