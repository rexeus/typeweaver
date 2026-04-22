export { createCli } from "./cli.js";

export { handleDoctorCommand } from "./commands/doctor.js";
export type {
  DoctorCommandContext,
  DoctorCommandOptions,
} from "./commands/doctor.js";

export { handleGenerateCommand } from "./commands/generate.js";
export type {
  GenerateCommandContext,
  GenerateCommandOptions,
  GenerateCommandResult,
} from "./commands/generate.js";

export { handleInitCommand } from "./commands/init.js";
export type {
  InitCommandContext,
  InitCommandOptions,
} from "./commands/init.js";

export { handleMigrateCommand } from "./commands/migrate.js";
export type {
  MigrateCommandContext,
  MigrateCommandOptions,
} from "./commands/migrate.js";

export { handleValidateCommand } from "./commands/validate.js";
export type {
  ValidateCommandContext,
  ValidateCommandOptions,
} from "./commands/validate.js";

export { createLogger } from "./logger.js";
export type { Logger } from "./logger.js";

export type {
  DoctorSummary,
  GenerateSummary,
  GenerationSummary,
  InitSummary,
  MigrateSummary,
} from "./generationResult.js";
export type { ValidationReport } from "./validate/index.js";
